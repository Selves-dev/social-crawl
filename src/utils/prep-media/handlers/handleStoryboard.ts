
import { logger } from '../../shared/logger';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';
import sharp from 'sharp';
import { BlobServiceClient } from '@azure/storage-blob';
import { generateBlobSasUrl } from '../../shared/azureBlob';

export async function extractVideoSegments(tmpVideoPath: string, segmentDir: string): Promise<string[]> {
  logger.info('Creating segment directory', { segmentDir });
  fs.mkdirSync(segmentDir, { recursive: true });
  // Ensure blank image exists
  const blankImagePath = path.resolve(process.cwd(), 'src/assets/blank.jpg');
  if (!fs.existsSync(blankImagePath)) {
    logger.info('Creating blank image', { blankImagePath });
    // Use ffmpeg to create a blank white image 180x320
    const { spawnSync } = require('child_process');
    spawnSync('ffmpeg', ['-f', 'lavfi', '-i', 'color=c=white:s=180x320', '-frames:v', '1', blankImagePath]);
  }
  const ffmpegArgs = [
    '-hide_banner', '-loglevel', 'error',
    '-i', tmpVideoPath,
    '-vf', 'fps=1/2',
    path.join(segmentDir, 'frame_%03d.jpg')
  ];
  logger.info('Spawning ffmpeg for segment extraction', { tmpVideoPath, segmentDir, ffmpegArgs });
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.on('close', (code: number) => {
      logger.info('ffmpeg process closed', { code });
      if (code === 0) {
        logger.info('Extracted video segments', { segmentDir });
        resolve(true);
      } else {
      logger.error('ffmpeg segment extraction failed');
      logger.info('ffmpeg context', { tmpVideoPath, segmentDir, ffmpegArgs });
      reject(new Error('ffmpeg segment extraction failed'));
      }
    });
    ffmpeg.on('error', (err) => {
      logger.error('ffmpeg process error: ' + (err instanceof Error ? err.message : String(err)));
      logger.info('ffmpeg context', { tmpVideoPath, segmentDir, ffmpegArgs });
      reject(err);
    });
  });
  // Get sorted frame files numerically
  let files = fs.readdirSync(segmentDir)
    .filter(f => /^frame_\d+\.jpg$/.test(f))
    .sort((a, b) => {
      // Sort by frame number
      const numA = parseInt(a.match(/(\d+)/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/(\d+)/)?.[0] || '0', 10);
      return numA - numB;
    })
    .map(f => path.join(segmentDir, f));
  if (files.length === 0) {
    logger.warn('No frames extracted from video', { tmpVideoPath, segmentDir, ffmpegArgs });
  }
  logger.info('Segment files found', { files });
  return files;
}

// ...removed duplicate code...

export async function handleStoryboard(
  tmpVideoPath: string,
  blobServiceClient: BlobServiceClient,
  containerName: string,
  assetBaseName: string,
  platform: string,
  videoUrl?: string
): Promise<string[]> {
  // Detect isShorts for YouTube
  let isShorts = false;
  if (platform === 'youtube' && videoUrl && videoUrl.includes('/shorts/')) {
    isShorts = true;
  }

  logger.info('handleStoryboard: extracting segments', { tmpVideoPath, assetBaseName, platform, videoUrl });
  const segmentDir = path.join(os.tmpdir(), `${assetBaseName}-segments`);
  const segmentPaths = await extractVideoSegments(tmpVideoPath, segmentDir);
  logger.info('handleStoryboard: segmentPaths', { segmentPaths });
  const gridSize = 4;
  // Use dynamic dimensions
  const { width: thumbWidth, height: thumbHeight } = getOutputDimensions(platform, isShorts);
  const blankImagePath = path.resolve(process.cwd(), 'src/assets/blank.jpg');
  const storyboardUrls: string[] = [];
  for (let i = 0; i < segmentPaths.length; i += gridSize * gridSize) {
    // Get up to gridSize*gridSize images for this grid
    const gridImages = segmentPaths.slice(i, i + gridSize * gridSize);
    // Pad with blank frames if needed
    while (gridImages.length < gridSize * gridSize) {
      gridImages.push(blankImagePath);
    }
    logger.info('Final grid images (with blanks)', { gridImages });
    // Ensure all images are sized according to platform
    const resizedBuffers: Buffer[] = [];
    for (const imgPath of gridImages) {
      const buf = await fs.promises.readFile(imgPath);
      const resized = await sharp(buf).resize(thumbWidth, thumbHeight).toBuffer();
      resizedBuffers.push(resized);
    }
    // Prepare composite array for sharp
    const composite: any[] = [];
    for (let idx = 0; idx < resizedBuffers.length; idx++) {
      const x = idx % gridSize;
      const y = Math.floor(idx / gridSize);
      composite.push({ input: resizedBuffers[idx], top: y * thumbHeight, left: x * thumbWidth });
    }
    // Create the grid image
    const storyboardBuffer = await sharp({
      create: {
        width: thumbWidth * gridSize,
        height: thumbHeight * gridSize,
        channels: 3,
        background: '#fff',
      },
    })
      .composite(composite)
      .jpeg()
      .toBuffer();
    // Save to temp file
    const gridIdx = Math.floor(i / (gridSize * gridSize));
    const storyboardPath = path.join(os.tmpdir(), `${assetBaseName}-storyboard-${gridIdx}.jpg`);
    fs.writeFileSync(storyboardPath, storyboardBuffer);
    // Upload to blob
    const storyboardBlobName = `${assetBaseName}-storyboard-${gridIdx}.jpg`;
    const storyboardBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(storyboardBlobName);
    await storyboardBlob.uploadFile(storyboardPath);
    logger.info('Uploaded storyboard to blob', { blobName: storyboardBlobName });
    const storyboardSasUrl = await generateBlobSasUrl(storyboardBlob);
    storyboardUrls.push(storyboardSasUrl);
  }
  return storyboardUrls;
}

// Utility to determine output dimensions based on platform/source
function getOutputDimensions(platform: string, isShorts: boolean = false) {
  // Default portrait (TikTok, Instagram, YouTube Shorts)
  let width = 240;
  let height = 426;

  if (platform === 'youtube') {
    if (isShorts) {
      // YouTube Shorts: portrait
      width = 240;
      height = 426;
    } else {
      // Regular YouTube: landscape
      width = 426;
      height = 240;
    }
  }
  return { width, height };
}
