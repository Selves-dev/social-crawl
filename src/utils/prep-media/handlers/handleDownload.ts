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

  // Download video to tmp and upload to blob
  const tmpVideoPath = path.join(os.tmpdir(), `${blobId}-video.mp4`);
  const videoBlobName = `${blobId}-video.mp4`;
  const videoBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(videoBlobName);
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
  logger.info('Uploading video to blob', { tmpVideoPath, blobName: videoBlobName });
  await videoBlob.uploadFile(tmpVideoPath);
  logger.info('Streamed video to blob', { blobName: videoBlobName });


  // Extract audio from downloaded MP4 using ffmpeg and upload to blob
  const audioBlobName = `${blobId}-audio.mp3`;
  const audioBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(audioBlobName);
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
  logger.info('Uploading audio to blob', { tmpAudioPath, blobName: audioBlobName });
  await audioBlob.uploadFile(tmpAudioPath);
  logger.info('Uploaded audio to blob', { blobName: audioBlobName });

  // Generate SAS tokens for video and audio blobs
  const videoSasUrl = await generateBlobSasUrl(videoBlob);
  const audioSasUrl = await generateBlobSasUrl(audioBlob);
  return {
    video: videoSasUrl,
    audio: audioSasUrl
  };
}

export async function handleDownloadThumbnail(blobId: string, thumbUrl: string, blobServiceClient: any, containerName: string) {
  if (!blobServiceClient) {
    throw new Error('Missing Azure Storage connection string');
  }
  const thumbBlobName = `${blobId}-thumbnail.jpg`;
  const thumbBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(thumbBlobName);
  const response = await axios.get(thumbUrl, { responseType: 'stream' });
  await thumbBlob.uploadStream(response.data);
  // Generate SAS token for thumbnail blob
  const thumbSasUrl = await generateBlobSasUrl(thumbBlob);
  return thumbSasUrl;
}
