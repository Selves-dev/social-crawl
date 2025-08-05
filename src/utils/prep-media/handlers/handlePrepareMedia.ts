import { logger } from '../../shared/logger';
import { getBlobJson, getBlobServiceClient, updateBlobJson } from '../../shared/azureBlob';
import type { BlobManifest } from '../../shared/types';
import axios from 'axios';
import { spawn } from 'child_process';
import { BlobServiceClient } from '@azure/storage-blob';
import * as path from 'path';
import * as os from 'os';

import { extractVideoSegments, handleStoryboard } from './handleStoryboard';
import { handleDownload, handleDownloadThumbnail } from './handleDownload';
import { sendToPostOffice } from '../../shared/postOffice/postman';

export async function handlePrepareMedia(message: any) {
  logger.info('handlePrepareMedia called', { message });

  const { workflow, payload } = message;
  const blobUrl = payload?.blobUrl;

  // 1. Fetch JSON object from blob
  let blobJson: BlobManifest;
  try {
    blobJson = await getBlobJson(blobUrl) as BlobManifest;
    logger.info('Fetched blob JSON', { blobJson });
    // Use mediaId from mapped object only
  } catch (err) {
    logger.error('Failed to fetch blob JSON', err instanceof Error ? err : new Error(String(err)));
    return;
  }

  // Track media blob URLs
  const media: BlobManifest['media'] = [];
  const blobServiceClient = getBlobServiceClient();
  if (!blobServiceClient) {
    logger.error('Missing Azure Storage connection string');
    return;
  }
  // Always use 'media' container for all blob operations
  const mediaContainerName = 'media';

  // Determine platform and mediaId for folder structure
  let platform = 'unknown';
  if (blobJson.link) {
    if (blobJson.link.includes('youtube.com')) platform = 'youtube';
    else if (blobJson.link.includes('tiktok.com')) platform = 'tiktok';
    else if (blobJson.link.includes('instagram.com')) platform = 'instagram';
  }
  const id = blobJson.mediaId;
  if (!id) {
    logger.error('Could not determine mediaId from mapped object, aborting.');
    return;
  }
  const baseFolder = `${platform}/json/${id}`;

  // 2. Download video and audio, upload to blob
  let tmpVideoPath = path.join(os.tmpdir(), `${id}-video.mp4`);
  try {
    if (!blobJson.link) {
      logger.error('No video link found in blobJson');
      return;
    }
    // Use baseFolder for video/audio blob names
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
    const assetBaseName = `${baseFolder}/${platform}-${id}-${timestamp}`;
    const downloadResults = await handleDownload(assetBaseName, blobJson.link, blobServiceClient, mediaContainerName);
    media.push({ type: 'video', url: downloadResults.video });
    media.push({ type: 'audio', url: downloadResults.audio });
    logger.info('Downloaded and uploaded media', { video: downloadResults.video, audio: downloadResults.audio });
    // If you have a compressed video, update tmpVideoPath to point to it before storyboard extraction
    if (downloadResults.tmpCompressedPath) {
      tmpVideoPath = downloadResults.tmpCompressedPath;
      logger.info('Updated tmpVideoPath to compressed video', { tmpVideoPath });
    }
  } catch (err) {
    logger.error('Failed to download and upload media', err instanceof Error ? err : new Error(String(err)));
    return;
  }

  // 3. Build 4x4 storyboard grid(s) using sharp (helper) and extract segments
  let storyboardUrls: string[] = [];
  try {
    logger.info('Calling handleStoryboard', { tmpVideoPath, blobId: blobJson.id, platform, videoUrl: blobJson.link });
    // Use baseFolder for storyboard blob names
    const timestampStoryboard = new Date().toISOString().replace(/[-:.TZ]/g, "");
    const storyboardAssetName = `${baseFolder}/${platform}-${id}-${timestampStoryboard}`;
    storyboardUrls = await handleStoryboard(
      tmpVideoPath,
      blobServiceClient,
      mediaContainerName,
      storyboardAssetName,
      platform,
      blobJson.link
    );
    logger.info('handleStoryboard returned', { storyboardUrls });
    media.push({ type: 'storyboards', url: storyboardUrls.join(',') });
  } catch (err) {
    logger.error('Failed to build/upload storyboard', err instanceof Error ? err : new Error(String(err)));
  }

  // 4. Download thumbnail from the URL by streaming to blob
  try {
    const thumbUrl = blobJson.thumbnail || blobJson.thumbnailUrl || message.thumbnailUrl;
    // ...no thumbnail logging before download...
    if (thumbUrl) {
      logger.info('Getting thumbnail from URL', { thumbUrl });
      const thumbTimestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
      const thumbAssetName = `${baseFolder}/${platform}-${id}-${thumbTimestamp}-thumbnail.jpg`;
      const thumbnailUrl = await handleDownloadThumbnail(thumbAssetName, thumbUrl, blobServiceClient, mediaContainerName);
      media.push({ type: 'thumbnail', url: thumbnailUrl });
      logger.info('Streamed thumbnail to blob', { thumbnail: thumbnailUrl });
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
      const outgoingMessage = {
        util: 'analyse-media',
        type: 'analyse-media-queued',
        apiSecret: process.env['taash-secret'],
        workflow,
        payload: {
          blobUrl
        }
      };
      logger.info('[handlePrepareMedia] Sending to postal system', { outgoingMessage });
      await sendToPostOffice(outgoingMessage);
      logger.info('[handlePrepareMedia] Routed to analyse-media', { blobUrl, workflow });
    } else {
      logger.warn('No workflow context for analyse-media routing');
    }
  } catch (err) {
    logger.error('Failed to update blob JSON with media URLs', err instanceof Error ? err : new Error(String(err)));
    logger.error(`Blob update error details: blobUrl=${blobUrl}, media=${JSON.stringify(media)}`);
  }
}
