

import { logger } from '../../shared/logger';
import { getBlobJson } from '../../shared/azureBlob';
import axios from 'axios';
import { spawn } from 'child_process';
import { BlockBlobClient, BlobServiceClient } from '@azure/storage-blob';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { extractVideoSegments, handleStoryboard } from './handleStoryboard';
import { handleDownload } from './handleDownload';




export async function handlePrepareMedia(message: any) {
  logger.info('handlePrepareMedia called', { message });

  const { workflow, blobUrl, mediaUrl } = message;

  // 1. Fetch JSON object from blob
  let blobJson;
  try {
    blobJson = await getBlobJson(blobUrl);
    logger.info('Fetched blob JSON', { blobJson });
  } catch (err) {
    logger.error('Failed to fetch blob JSON', err instanceof Error ? err : new Error(String(err)));
    return;
  }

  // Helper to get connection string
  const connectionString = process.env["AZURE_STORAGE_CONNECTION_STRING"];
  if (!connectionString) {
    logger.error('Missing Azure Storage connection string');
    return;
  }

  // Track media blob URLs
  const media = {} as Record<string, string>;
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerName = 'media';

  // 2. Download video and audio, upload to blob
  let tmpVideoPath = path.join(os.tmpdir(), `${blobJson.id}-video.mp4`);
  try {
    const downloadResults = await handleDownload(blobServiceClient, containerName, blobJson.id, mediaUrl);
    media.video = downloadResults.video;
    media.audio = downloadResults.audio;
  } catch (err) {
    logger.error('Failed to download and upload media', err instanceof Error ? err : new Error(String(err)));
    return;
  }

  // 3. Split video into 2s portrait images using ffmpeg (helper)
  let segmentPaths: string[] = [];
  try {
    const segmentDir = path.join(os.tmpdir(), `${blobJson.id}-segments`);
    segmentPaths = await extractVideoSegments(tmpVideoPath, segmentDir);
  } catch (err) {
    logger.error('Failed to extract video segments', err instanceof Error ? err : new Error(String(err)));
    return;
  }

  // 4. Build 4x4 storyboard grid(s) using sharp (helper)
  let storyboardUrls: string[] = [];
  try {
    storyboardUrls = await handleStoryboard(segmentPaths, blobServiceClient, containerName, blobJson.id);
    (media as { storyboards?: string[] }).storyboards = storyboardUrls;
  } catch (err) {
    logger.error('Failed to build/upload storyboard', err instanceof Error ? err : new Error(String(err)));
  }

  // 3. Download thumbnail from the URL by streaming to blob
  try {
    const thumbUrl = blobJson.thumbnailUrl || message.thumbnailUrl;
    if (thumbUrl) {
      const thumbBlobName = `${blobJson.id}-thumbnail.jpg`;
      const thumbBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(thumbBlobName);
      const response = await axios.get(thumbUrl, { responseType: 'stream' });
      await thumbBlob.uploadStream(response.data);
      logger.info('Streamed thumbnail to blob', { blobName: thumbBlobName });
      media.thumbnail = thumbBlob.url;
    } else {
      logger.warn('No thumbnail URL provided');
    }
  } catch (err) {
    logger.error('Failed to stream thumbnail to blob', err instanceof Error ? err : new Error(String(err)));
  }

  // 5. Update blob JSON with media URLs
  try {
    blobJson.media = media;
    const originalBlobUrl = new URL(blobUrl);
    const matches = originalBlobUrl.pathname.match(/\/([^\/]+)\/([^\/]+)$/);
    if (!matches) throw new Error('Invalid blob URL');
    const container = blobServiceClient.getContainerClient(matches[1]);
    const blob = container.getBlockBlobClient(matches[2]);
    await blob.upload(JSON.stringify(blobJson), Buffer.byteLength(JSON.stringify(blobJson)), { blobHTTPHeaders: { blobContentType: 'application/json' } });
    logger.info('Updated blob JSON with media URLs', { blobUrl });
  } catch (err) {
    logger.error('Failed to update blob JSON with media URLs', err instanceof Error ? err : new Error(String(err)));
  }
}
