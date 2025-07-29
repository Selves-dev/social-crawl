import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { BlobServiceClient } from '@azure/storage-blob';
import { logger } from '../../shared/logger';

export async function handleDownload(blobServiceClient: BlobServiceClient, containerName: string, blobId: string, mediaUrl: string) {
  // Download video to tmp and upload to blob
  const tmpVideoPath = path.join(os.tmpdir(), `${blobId}-video.mp4`);
  await new Promise((resolve, reject) => {
    const video = spawn('yt-dlp', ['-f', 'bestvideo', '-o', tmpVideoPath, mediaUrl]);
    video.on('close', (code) => {
      if (code === 0) {
        logger.info('Downloaded video to tmp', { tmpVideoPath });
        resolve(true);
      } else {
        reject(new Error('yt-dlp video download failed'));
      }
    });
    video.on('error', reject);
  });
  const videoBlobName = `${blobId}-video.mp4`;
  const videoBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(videoBlobName);
  await videoBlob.uploadFile(tmpVideoPath);
  logger.info('Streamed video to blob', { blobName: videoBlobName });

  // Download audio and upload to blob
  await new Promise((resolve, reject) => {
    const audio = spawn('yt-dlp', ['-f', 'bestaudio', '-o', '-', mediaUrl]);
    const audioBlobName = `${blobId}-audio.mp3`;
    const audioBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(audioBlobName);
    audioBlob.uploadStream(audio.stdout)
      .then(() => {
        logger.info('Streamed audio to blob', { blobName: audioBlobName });
        resolve(true);
      })
      .catch(reject);
    audio.on('error', reject);
  });

  return {
    video: videoBlob.url,
    audio: audioBlob.url
  };
}
