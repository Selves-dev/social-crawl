import sharp from 'sharp';
import { Readable } from 'stream';

// Compress/resize a storyboard image using sharp
export async function compressStoryboardImage(inputPath: string, outputPath: string, options: { width?: number, height?: number, quality?: number } = {}): Promise<void> {
  const { width = 320, height = 180, quality = 70 } = options;
  await sharp(inputPath)
    .resize(width, height, { fit: 'inside' })
    .jpeg({ quality })
    .toFile(outputPath);
}
// Compress video with ffmpeg
export async function compressVideo(inputPath: string, outputPath: string, landscape: boolean): Promise<void> {
  let ffmpegArgs = ['-y', '-i', inputPath, '-vf', 'scale=240:426', '-b:v', '400k', '-c:v', 'libx264', '-preset', 'fast', outputPath];
  if (landscape) {
    ffmpegArgs = ['-y', '-i', inputPath, '-vf', 'scale=426:240', '-b:v', '400k', '-c:v', 'libx264', '-preset', 'fast', outputPath];
  }
  logger.info('Adding compression for video');
  logger.debug('Spawning ffmpeg for video compression', { cmd: 'ffmpeg', args: ffmpegArgs });
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stdout.on('data', (data) => logger.debug('ffmpeg compress stdout', { data: data.toString() }));
    ffmpeg.stderr.on('data', (data) => logger.debug('ffmpeg compress stderr', { data: data.toString() }));
    ffmpeg.on('close', (code) => {
      logger.debug('ffmpeg compress process closed', { code });
      if (code === 0) {
        logger.debug('Compressed video to tmp', { outputPath });
        resolve(true);
      } else {
        logger.error('ffmpeg video compression failed');
        reject(new Error('ffmpeg video compression failed'));
      }
    });
    ffmpeg.on('error', (err) => {
      logger.error(err instanceof Error ? err.message : String(err));
      reject(err);
    });
  });
  if (!fs.existsSync(outputPath)) {
    logger.error(`Compressed video file does not exist: ${outputPath}`);
    throw new Error('Compressed video file does not exist');
  }
}

// Extract audio from video using ffmpeg
export async function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  logger.debug('Spawning ffmpeg to extract audio from video', {
    cmd: 'ffmpeg',
    args: ['-y', '-i', inputPath, '-vn', '-acodec', 'libmp3lame', outputPath]
  });
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ['-y', '-i', inputPath, '-vn', '-acodec', 'libmp3lame', outputPath]);
    ffmpeg.stdout.on('data', (data) => logger.debug('ffmpeg stdout', { data: data.toString() }));
    ffmpeg.stderr.on('data', (data) => logger.debug('ffmpeg stderr', { data: data.toString() }));
    ffmpeg.on('close', (code) => {
      logger.debug('ffmpeg process closed', { code });
      if (code === 0) {
        logger.debug('Extracted audio to tmp', { outputPath });
        resolve(true);
      } else {
        logger.error('ffmpeg audio extraction failed');
        reject(new Error('ffmpeg audio extraction failed'));
      }
    });
    ffmpeg.on('error', (err) => {
      logger.error(err instanceof Error ? err.message : String(err));
      reject(err);
    });
  });
  if (!fs.existsSync(outputPath)) {
    logger.error(`Extracted audio file does not exist: ${outputPath}`);
    throw new Error('Extracted audio file does not exist');
  }
}

// Download and upload thumbnail
export async function downloadAndUploadThumbnail(
  blobServiceClient: any,
  blobId: string,
  thumbUrl: string,
  containerName: string,
  generateBlobSasUrl: any,
  platform: string,
  cc?: string,
  l?: string
): Promise<string> {
  // Always use the 'public' container for thumbnails
  // For thumbnails, group by platform/cc/l only (no json/<id>)
  const platformPath = platform ? platform.toLowerCase() : '';
  const ccPath = cc ? cc.toLowerCase() : '';
  const lPath = l ? l.toLowerCase() : '';
  const thumbFolder = [platformPath, ccPath, lPath].filter(Boolean).join('/');
  // Use only the last segment of blobId for the filename
  const blobIdParts = blobId.split('/');
  const thumbFileName = blobIdParts[blobIdParts.length - 1];
  const finalThumbBlobName = `${thumbFolder}/${thumbFileName}`;
  const thumbBlob = blobServiceClient.getContainerClient('public').getBlockBlobClient(finalThumbBlobName);
  let headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  };
  if (platform === 'tiktok') {
    headers['Referer'] = 'https://www.tiktok.com/';
  } else if (platform === 'instagram') {
    headers['Referer'] = 'https://www.instagram.com/';
  } else if (platform === 'youtube') {
    headers['Referer'] = 'https://www.youtube.com/';
  }
  const response = await axios.get(thumbUrl, {
    responseType: 'arraybuffer', // Get as buffer instead of stream
    headers
  });
  
  // Convert image to JPEG using Sharp to ensure compatibility with OpenAI
  // This handles AVIF, WebP, PNG, and other formats that might be served as thumbnails
  const jpegBuffer = await sharp(Buffer.from(response.data))
    .jpeg({ quality: 85 })
    .toBuffer();
  
  // Upload with proper content type for images
  await thumbBlob.uploadStream(Readable.from([jpegBuffer]), undefined, undefined, {
    blobHTTPHeaders: {
      blobContentType: 'image/jpeg'
    }
  });
  // Construct ImageKit.io URL for the thumbnail
  // Example: https://ik.imagekit.io/yond/az/<platform>/<cc>/<l>/<filename>
  const imageKitUrl = `https://ik.imagekit.io/yond/az/${thumbFolder}/${thumbFileName}`;
  return imageKitUrl;
}


// Download utilities for media handling (migrated from downloaders.ts and handleDownload.ts)

import { spawn } from 'child_process';
import * as fs from 'fs';
import axios from 'axios';
import { logger } from './logger';

// --- Existing downloaders.ts content will be moved here ---

// Get final download URL from RapidAPI YouTube service
export async function getFinalUrl(mediaUrl: string, rapidApiKey: string): Promise<string> {
  const apiUrl = 'https://youtube-info-download-api.p.rapidapi.com/ajax/download.php';
  const params = new URLSearchParams({
    format: '360',
    add_info: '0',
    url: mediaUrl,
    audio_quality: '128',
    allow_extended_duration: 'false',
    no_merge: 'false',
    audio_language: 'en'
  });
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const initResp = await axios.get(`${apiUrl}?${params.toString()}`, {
        headers: {
          'x-rapidapi-host': 'youtube-info-download-api.p.rapidapi.com',
          'x-rapidapi-key': rapidApiKey
        },
        timeout: 60000
      });
      if (!initResp.data?.progress_url) {
        throw new Error('No progress_url in RapidAPI response');
      }
      const progressUrl = initResp.data.progress_url;
      logger.info('Polling RapidAPI progress URL', { progressUrl });
      let downloadUrl: string | undefined;
      const maxTries = 180;
      for (let i = 0; i < maxTries; i++) {
        logger.debug(`Polling attempt ${i + 1} for RapidAPI progress`, { progressUrl });
        await new Promise(res => setTimeout(res, 1000));
        const pollResp = await axios.get(progressUrl, {
          headers: {
            'x-rapidapi-host': 'youtube-info-download-api.p.rapidapi.com',
            'x-rapidapi-key': rapidApiKey
          },
          timeout: 30000
        });
        if (pollResp.data?.download_url) {
          downloadUrl = pollResp.data.download_url;
          break;
        }
        if (pollResp.data?.status === 'done' && pollResp.data?.url) {
          downloadUrl = pollResp.data.url;
          break;
        }
        if (pollResp.data?.status === 'error') {
          throw new Error('RapidAPI download error: ' + (pollResp.data?.message || 'unknown error'));
        }
      }
      if (!downloadUrl) {
        throw new Error('Timed out waiting for RapidAPI download to complete');
      }
      logger.info('Successfully obtained final download URL from RapidAPI', { downloadUrl });
      return downloadUrl;
    } catch (err: any) {
      lastError = err;
      if (err.response) {
        logger.error(`RapidAPI YouTube URL retrieval failed for url: ${mediaUrl} (attempt ${attempt}) - status: ${err.response.status} - data: ${JSON.stringify(err.response.data)}`);
      } else {
        logger.error(`RapidAPI YouTube URL retrieval failed for url: ${mediaUrl} (attempt ${attempt}) - ${err instanceof Error ? err.message : String(err)}`);
      }
      if (attempt === 2) throw err;
      // else, retry once
    }
  }
  throw lastError;
}

// Download video from URL using yt-dlp
export async function downloadFromUrl(downloadUrl: string, tmpVideoPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = spawn('yt-dlp', ['-f', 'best', '-o', tmpVideoPath, downloadUrl]);
    let stderr = '';
    video.stdout.on('data', (data) => {
      logger.debug('yt-dlp video stdout', { data: data.toString() });
    });
    video.stderr.on('data', (data) => {
      const msg = data.toString();
      stderr += msg;
      logger.debug('yt-dlp video stderr', { data: msg });
    });
    video.on('close', (code) => {
      logger.debug('yt-dlp video process closed', { code });
      if (code === 0) {
        logger.debug('Downloaded video to tmp', { tmpVideoPath });
        resolve();
      } else {
        logger.error(`yt-dlp video download failed for url: ${downloadUrl} (code: ${code})\nstderr: ${stderr}`);
        reject(new Error(`yt-dlp video download failed for url: ${downloadUrl} (code: ${code})\nstderr: ${stderr}`));
      }
    });
    video.on('error', (err) => {
      logger.error(`yt-dlp process error for url: ${downloadUrl} - ${err instanceof Error ? err.message : String(err)}`);
      reject(err);
    });
  });
}

// Unified download workflow
export async function downloadMedia(mediaUrl: string, tmpVideoPath: string, rapidApiKey: string): Promise<void> {
  const finalUrl = await getFinalUrl(mediaUrl, rapidApiKey);
  await downloadFromUrl(finalUrl, tmpVideoPath);
  logger.info('Downloaded video to tmp via yt-dlp from RapidAPI', { tmpVideoPath });
}

// --- Utility functions to migrate from handleDownload.ts will be added here next ---
