import { logger } from '../../shared/logger';
import { getBlobJson, getBlobServiceClient, updateBlobJson } from '../../shared/azureBlob';
import type { BlobManifest } from '../../shared/types';
import { extractVideoSegments, handleStoryboard } from './handleStoryboard';
import { handleDownload, handleDownloadThumbnail } from './handleDownload';
import { sendToPostOffice } from '../../shared/postOffice/postman';
import axios from 'axios';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';


export async function handlePrepareMedia(message: any) {
  logger.info('handlePrepareMedia called', { message });

  const { workflow, payload } = message;
  const blobUrl = payload?.blobUrl;

  // 1. Fetch JSON object from blob
  let blobJson: BlobManifest;

  blobJson = await getBlobJson(blobUrl) as BlobManifest;
  logger.debug('Fetched blob JSON', { blobJson });

  const media: BlobManifest['media'] = [];
  // Always use 'media' container for all blob operations
  const mediaContainerName = 'media';
  
  // Initialize groupBlobUrls variable
  let groupBlobUrls: string[] = [];

const platforms = [
  { name: 'youtube', pattern: /youtube\.com/ },
  { name: 'tiktok', pattern: /tiktok\.com/ },
  { name: 'instagram', pattern: /instagram\.com/ }
];

const platform = platforms.find(p => p.pattern.test(blobJson.link))?.name || 'unknown';

if (platform === 'unknown') {
  logger.error(`Could not determine platform from blobJson.link: ${blobJson.link}`);
  return;
}

const { mediaId: id } = blobJson;
if (!id) {
  logger.error('Could not determine mediaId from mapped object, aborting.');
  return;
}
  const baseFolder = `${platform}/json/${id}`;
  let tmpVideoPath = path.join(os.tmpdir(), `${id}-video.mp4`);
  try {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
    const assetBaseName = `${baseFolder}/${platform}-${id}-${timestamp}`;
    const downloadResults = await handleDownload(assetBaseName, blobJson.link, mediaContainerName);
    media.push({ type: 'video', url: downloadResults.video });
    media.push({ type: 'audio', url: downloadResults.audio });
    logger.debug('Downloaded and uploaded media', { video: downloadResults.video, audio: downloadResults.audio });
    if (downloadResults.tmpCompressedPath) {
      tmpVideoPath = downloadResults.tmpCompressedPath;
      logger.debug('Updated tmpVideoPath to compressed video', { tmpVideoPath });
    }
  } catch (err) {
    logger.error('Failed to download and upload media', err instanceof Error ? err : new Error(String(err)));
    return;
  }

  try {
    const storyboardAssetName = `${baseFolder}/${platform}-${id}-${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;
    groupBlobUrls = await handleStoryboard(tmpVideoPath, mediaContainerName, storyboardAssetName, platform, blobJson.link, blobJson);
    
    logger.info('Storyboards processed and group blob JSONs created', { 
      totalGroups: groupBlobUrls.length
    });
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
      const thumbnailUrl = await handleDownloadThumbnail(thumbAssetName, thumbUrl, mediaContainerName);
      media.push({ type: 'thumbnail', url: thumbnailUrl });
      logger.debug('Streamed thumbnail to blob', { thumbnail: thumbnailUrl });
    } else {
      logger.warn('No thumbnail URL provided');
    }
  } catch (err) {
    logger.error('Failed to stream thumbnail to blob', err instanceof Error ? err : new Error(String(err)));
  }

  // 5. Update blob JSON with media URLs
  try {
    logger.debug('Attempting to update JSON blob', { jsonBlobUrl: blobUrl, media, workflow });
    logger.debug('Calling updateBlobJson', { blobUrl, media, workflow });
    const result = await updateBlobJson(blobUrl, (json) => {
      logger.debug('Inside updateBlobJson callback', { currentJson: json, newMedia: media, workflow });
      json.media = media;
      json.workflow = workflow;
      return json;
    });
    logger.debug('updateBlobJson result', { result });
    logger.debug('Updated blob JSON with media URLs and workflow', { blobUrl });
    
    // Route to analyse-media - send jobs for each group blob JSON
    if (workflow && groupBlobUrls && groupBlobUrls.length > 0) {
      for (let i = 0; i < groupBlobUrls.length; i++) {
        const groupBlobUrl = groupBlobUrls[i];
        const outgoingMessage = {
          util: 'analyse-media',
          type: 'analyse-media',
          apiSecret: process.env['taash-secret'],
          workflow,
          payload: {
            blobUrl: groupBlobUrl
          }
        };
        logger.debug('[handlePrepareMedia] Sending group blob to postal system', { 
          groupIndex: i, 
          groupBlobUrl,
          totalGroups: groupBlobUrls.length 
        });
        await sendToPostOffice(outgoingMessage);
      }
      logger.info('[handlePrepareMedia] Routed all storyboard groups to analyse-media', { 
        totalGroups: groupBlobUrls.length,
        workflow 
      });
    } else {
      logger.warn('No storyboard groups created - skipping analyse-media routing');
    }
  } catch (err) {
    logger.error('Failed to update blob JSON with media URLs', err instanceof Error ? err : new Error(String(err)));
    logger.error(`Blob update error details: blobUrl=${blobUrl}, media=${JSON.stringify(media)}`);
  }
}
