import { logger } from '../../shared/logger';
import { getBlobJson, getBlobServiceClient, updateBlobJson } from '../../shared/azureBlob';
import axios from 'axios';
import { spawn } from 'child_process';
import { BlobServiceClient } from '@azure/storage-blob';
import * as path from 'path';
import * as os from 'os';

import { extractVideoSegments, handleStoryboard } from './handleStoryboard';
import { handleDownload, handleDownloadThumbnail } from './handleDownload';
import { sendPostmanMessage, analyseMediaQueueName } from '../../shared/serviceBus';

export async function handlePrepareMedia(message: any) {
  logger.info('handlePrepareMedia called', { message });

  const { workflow, blobUrl, mediaUrl } = message;

  // 1. Fetch JSON object from blob
  let blobJson;
  try {
    blobJson = await getBlobJson(blobUrl);
    logger.info('Fetched blob JSON', { blobJson });
    // Ensure id is set from link if missing
    if (!blobJson.id && blobJson.link) {
      // TikTok
      let match = blobJson.link.match(/tiktok\.com\/[^\/]+\/video\/(\d+)/);
      if (match) blobJson.id = match[1];
      // Instagram
      match = blobJson.link.match(/instagram\.com\/reel\/([\w-]+)/);
      if (match) blobJson.id = match[1];
      // YouTube
      match = blobJson.link.match(/(?:v=|\/embed\/|\/shorts\/|\/watch\/)([\w-]+)/);
      if (match) blobJson.id = match[1];
      logger.info('Set blobJson.id from link', { id: blobJson.id });
    }
  } catch (err) {
    logger.error('Failed to fetch blob JSON', err instanceof Error ? err : new Error(String(err)));
    return;
  }

  // Track media blob URLs
  const media = {} as Record<string, string>;
  const blobServiceClient = getBlobServiceClient();
  if (!blobServiceClient) {
    logger.error('Missing Azure Storage connection string');
    return;
  }
  // Always use 'media' container for all blob operations
  const mediaContainerName = 'media';

  // 2. Download video and audio, upload to blob
  let tmpVideoPath = path.join(os.tmpdir(), `${blobJson.id}-video.mp4`);
  try {
    const downloadResults = await handleDownload(blobJson.id, mediaUrl, blobServiceClient, mediaContainerName);
    media.video = downloadResults.video; // should be blob URL
    media.audio = downloadResults.audio; // should be blob URL
    logger.info('Downloaded and uploaded media', { video: media.video, audio: media.audio });
  } catch (err) {
    logger.error('Failed to download and upload media', err instanceof Error ? err : new Error(String(err)));
    return;
  }

  // 3. Build 4x4 storyboard grid(s) using sharp (helper) and extract segments
  let storyboardUrls: string[] = [];
  try {
    logger.info('Calling handleStoryboard', { tmpVideoPath, blobId: blobJson.id });
    storyboardUrls = await handleStoryboard(tmpVideoPath, blobServiceClient, mediaContainerName, blobJson.id);
    logger.info('handleStoryboard returned', { storyboardUrls });
    (media as { storyboards?: string[] }).storyboards = storyboardUrls;
  } catch (err) {
    logger.error('Failed to build/upload storyboard', err instanceof Error ? err : new Error(String(err)));
  }

  // 4. Download thumbnail from the URL by streaming to blob
  try {
    const thumbUrl = blobJson.thumbnailUrl || message.thumbnailUrl;
    if (thumbUrl) {
      media.thumbnail = await handleDownloadThumbnail(blobJson.id, thumbUrl, blobServiceClient, mediaContainerName);
      logger.info('Streamed thumbnail to blob', { blobName: `${blobJson.id}-thumbnail.jpg`, thumbnail: media.thumbnail });
    } else {
      logger.warn('No thumbnail URL provided');
    }
  } catch (err) {
    logger.error('Failed to stream thumbnail to blob', err instanceof Error ? err : new Error(String(err)));
  }

  // 5. Update blob JSON with media URLs
  try {
    logger.info('Attempting to update JSON blob', { jsonBlobUrl: blobUrl, media });
    logger.info('Calling updateBlobJson', { blobUrl, media });
    const result = await updateBlobJson(blobUrl, (json) => {
      logger.info('Inside updateBlobJson callback', { currentJson: json, newMedia: media });
      json.media = media;
      return json;
    });
    logger.info('updateBlobJson result', { result });
    logger.info('Updated blob JSON with media URLs', { blobUrl });
    // Route to analyse-media
    if (workflow) {
      await sendPostmanMessage({
        util: 'analyse-media',
        payload: {
          workflow,
          blobUrl
        }
      });
      logger.info('Routed to analyse-media', { blobUrl, workflow });
    } else {
      logger.warn('No workflow context for analyse-media routing');
    }
  } catch (err) {
    logger.error('Failed to update blob JSON with media URLs', err instanceof Error ? err : new Error(String(err)));
    logger.error('Blob update error details', { blobUrl, media });
  }
}
