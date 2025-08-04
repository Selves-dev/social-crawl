
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { getBlobServiceClient } from '../../shared/azureBlob';
import { logger } from '../../shared/logger';
import axios from 'axios';
import { generateBlobSasUrl } from '../../shared/azureBlob';

export async function handleDownload(blobId: string, mediaUrl: string, blobServiceClient: any, containerName: string) {
  if (!blobServiceClient) {
    logger.error('Missing Azure Storage connection string');
    throw new Error('Missing Azure Storage connection string');
  }

  // Download video to tmp
  const tmpVideoPath = path.join(os.tmpdir(), `${blobId}-video.mp4`);
  const tmpCompressedPath = path.join(os.tmpdir(), `${blobId}-video-compressed.mp4`);
  const finalVideoBlobName = `${blobId}-video.mp4`;
  const videoBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(finalVideoBlobName);
  logger.info('Spawning yt-dlp for video', { cmd: 'yt-dlp', args: ['-f', 'best', '-o', tmpVideoPath, mediaUrl] });
  await new Promise((resolve, reject) => {
    const video = spawn('yt-dlp', ['-f', 'best', '-o', tmpVideoPath, mediaUrl]);
    video.stdout.on('data', (data) => logger.info('yt-dlp video stdout', { data: data.toString() }));
    video.stderr.on('data', (data) => logger.info('yt-dlp video stderr', { data: data.toString() }));
    video.on('close', (code) => {
      logger.info('yt-dlp video process closed', { code });
      if (code === 0) {
        logger.info('Downloaded video to tmp', { tmpVideoPath });
        resolve(true);
      } else {
        logger.error('yt-dlp video download failed');
        reject(new Error('yt-dlp video download failed'));
      }
    });
    video.on('error', (err) => {
      logger.error(err instanceof Error ? err.message : String(err));
      reject(err);
    });
  });
  if (!fs.existsSync(tmpVideoPath)) {
    logger.error(`Downloaded video file does not exist: ${tmpVideoPath}`);
    throw new Error('Downloaded video file does not exist');
  }
  // Compress video with ffmpeg (240x426 portrait, 426x240 landscape, 400k bitrate)
  // Default: portrait
  let ffmpegArgs = ['-y', '-i', tmpVideoPath, '-vf', 'scale=240:426', '-b:v', '400k', '-c:v', 'libx264', '-preset', 'fast', tmpCompressedPath];
  // Detect orientation by inspecting video dimensions (optional: can use platform info)
  // For now, use portrait for TikTok/Instagram/Shorts, landscape for YouTube
  if (/youtube\.com/.test(mediaUrl) && !/shorts/.test(mediaUrl)) {
    ffmpegArgs = ['-y', '-i', tmpVideoPath, '-vf', 'scale=426:240', '-b:v', '400k', '-c:v', 'libx264', '-preset', 'fast', tmpCompressedPath];
  }
  logger.info('Spawning ffmpeg for video compression', { cmd: 'ffmpeg', args: ffmpegArgs });
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stdout.on('data', (data) => logger.info('ffmpeg compress stdout', { data: data.toString() }));
    ffmpeg.stderr.on('data', (data) => logger.info('ffmpeg compress stderr', { data: data.toString() }));
    ffmpeg.on('close', (code) => {
      logger.info('ffmpeg compress process closed', { code });
      if (code === 0) {
        logger.info('Compressed video to tmp', { tmpCompressedPath });
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
  if (!fs.existsSync(tmpCompressedPath)) {
    logger.error(`Compressed video file does not exist: ${tmpCompressedPath}`);
    throw new Error('Compressed video file does not exist');
  }
  logger.info('Uploading compressed video to blob', { tmpCompressedPath, blobName: finalVideoBlobName });
  await videoBlob.uploadFile(tmpCompressedPath);
  logger.info('Streamed compressed video to blob', { blobName: finalVideoBlobName });


  // Extract audio from downloaded MP4 using ffmpeg and upload to blob
  const finalAudioBlobName = `${blobId}-audio.mp3`;
  const audioBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(finalAudioBlobName);
  const tmpAudioPath = path.join(os.tmpdir(), `${blobId}-audio.mp3`);
  logger.info('Spawning ffmpeg to extract audio from video', {
    cmd: 'ffmpeg',
    args: ['-y', '-i', tmpVideoPath, '-vn', '-acodec', 'libmp3lame', tmpAudioPath]
  });
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ['-y', '-i', tmpVideoPath, '-vn', '-acodec', 'libmp3lame', tmpAudioPath]);
    ffmpeg.stdout.on('data', (data) => logger.info('ffmpeg stdout', { data: data.toString() }));
    ffmpeg.stderr.on('data', (data) => logger.info('ffmpeg stderr', { data: data.toString() }));
    ffmpeg.on('close', (code) => {
      logger.info('ffmpeg process closed', { code });
      if (code === 0) {
        logger.info('Extracted audio to tmp', { tmpAudioPath });
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
  if (!fs.existsSync(tmpAudioPath)) {
    logger.error(`Extracted audio file does not exist: ${tmpAudioPath}`);
    throw new Error('Extracted audio file does not exist');
  }
  logger.info('Uploading audio to blob', { tmpAudioPath, blobName: finalAudioBlobName });
  await audioBlob.uploadFile(tmpAudioPath);
  logger.info('Uploaded audio to blob', { blobName: finalAudioBlobName });

  // Generate SAS tokens for video and audio blobs
  const videoSasUrl = await generateBlobSasUrl(videoBlob);
  const audioSasUrl = await generateBlobSasUrl(audioBlob);
  return {
    video: videoSasUrl,
    audio: audioSasUrl,
    tmpCompressedPath
  };
}

export async function handleDownloadThumbnail(blobId: string, thumbUrl: string, blobServiceClient: any, containerName: string) {
  if (!blobServiceClient) {
    throw new Error('Missing Azure Storage connection string');
  }
  const finalThumbBlobName = `${blobId}-thumbnail.jpg`;
  const thumbBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(finalThumbBlobName);
  const response = await axios.get(thumbUrl, {
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Referer': 'https://www.tiktok.com/'
    }
  });
  await thumbBlob.uploadStream(response.data);
  // Generate SAS token for thumbnail blob
  const thumbSasUrl = await generateBlobSasUrl(thumbBlob);
  return thumbSasUrl;
}

