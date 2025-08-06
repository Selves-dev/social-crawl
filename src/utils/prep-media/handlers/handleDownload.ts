
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { getBlobServiceClient } from '../../shared/azureBlob';
import { logger } from '../../shared/logger';
import { generateBlobSasUrl } from '../../shared/azureBlob';
import { downloadMedia, compressVideo, extractAudio, downloadAndUploadThumbnail } from '../../shared/downloadUtils';

export async function handleDownload(blobId: string, mediaUrl: string, containerName: string) {
  
  const blobServiceClient = getBlobServiceClient();
  if (!blobServiceClient) {
    logger.error('Missing Azure Storage connection string');
    throw new Error('Missing Azure Storage connection string');
  }

  // Download video to tmp
  const tmpVideoPath = path.join(os.tmpdir(), `${blobId}-video.mp4`);
  const finalVideoBlobName = `${blobId}-video.mp4`;

  const videoBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(finalVideoBlobName);
  logger.info('Downloading video - this does take a few seconds ...', { mediaUrl, tmpVideoPath });


  const rapidApiKey = process.env['rapidapi-key'] || '';
  if (!rapidApiKey) throw new Error('rapidapi-key env var required for RapidAPI YouTube downloader');
  logger.info('Starting downloadMedia', { mediaUrl, tmpVideoPath, rapidApiKeyPresent: !!rapidApiKey });
  await downloadMedia(mediaUrl, tmpVideoPath, rapidApiKey);

  // --- yt-dlp Downloader (uncomment to use instead) ---
  // await downloadWithYtDlp(mediaUrl, tmpVideoPath);


  if (!fs.existsSync(tmpVideoPath)) {
    logger.error(`Downloaded video file does not exist: ${tmpVideoPath}`);
    logger.debug('Downloaded video file missing context', { tmpVideoPath, cwd: process.cwd(), files: fs.readdirSync(path.dirname(tmpVideoPath)) });
    throw new Error('Downloaded video file does not exist');
  }
  // No video compression step; upload original video
  logger.debug('Uploading video to blob', { tmpVideoPath, blobName: finalVideoBlobName, fileSize: fs.existsSync(tmpVideoPath) ? fs.statSync(tmpVideoPath).size : null });
  await videoBlob.uploadFile(tmpVideoPath);
  logger.info('Streamed video to blob', { blobName: finalVideoBlobName });


  // Use extractAudio util
  const finalAudioBlobName = `${blobId}-audio.mp3`;
  const audioBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(finalAudioBlobName);
  const tmpAudioPath = path.join(os.tmpdir(), `${blobId}-audio.mp3`);
  logger.debug('Extracting audio from video', { tmpVideoPath, tmpAudioPath });
  await extractAudio(tmpVideoPath, tmpAudioPath);
  logger.debug('Audio extraction complete', { tmpAudioPath, exists: fs.existsSync(tmpAudioPath), fileSize: fs.existsSync(tmpAudioPath) ? fs.statSync(tmpAudioPath).size : null });
  logger.debug('Uploading audio to blob', { tmpAudioPath, blobName: finalAudioBlobName });
  await audioBlob.uploadFile(tmpAudioPath);
  logger.info('Uploaded audio to blob', { blobName: finalAudioBlobName });

  // Generate SAS tokens for video and audio blobs
  const videoSasUrl = await generateBlobSasUrl(videoBlob);
  const audioSasUrl = await generateBlobSasUrl(audioBlob);
  return {
    video: videoSasUrl,
    audio: audioSasUrl,
    tmpVideoPath
  };
}

export async function handleDownloadThumbnail(blobId: string, thumbUrl: string, containerName: string, platform: string) {
  const blobServiceClient = getBlobServiceClient();
  if (!blobServiceClient) {
    throw new Error('Missing Azure Storage connection string');
  }
  return downloadAndUploadThumbnail(blobServiceClient, blobId, thumbUrl, containerName, generateBlobSasUrl, platform);
}

