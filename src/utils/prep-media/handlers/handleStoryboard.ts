
import { logger } from '../../shared/logger';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';
import sharp from 'sharp';
import { BlobServiceClient } from '@azure/storage-blob';

export async function extractVideoSegments(tmpVideoPath: string, segmentDir: string): Promise<string[]> {
  logger.info('Creating segment directory', { segmentDir });
  fs.mkdirSync(segmentDir, { recursive: true });
  logger.info('Spawning ffmpeg for segment extraction', { tmpVideoPath, segmentDir });
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', tmpVideoPath,
      '-vf', 'fps=1/2,scale=720:1280',
      path.join(segmentDir, 'segment-%02d.jpg')
    ]);
    ffmpeg.stdout.on('data', (data) => logger.info('ffmpeg stdout', { data: data.toString() }));
    ffmpeg.stderr.on('data', (data) => logger.info('ffmpeg stderr', { data: data.toString() }));
    ffmpeg.on('close', (code: number) => {
      logger.info('ffmpeg process closed', { code });
      if (code === 0) {
        logger.info('Extracted video segments', { segmentDir });
        resolve(true);
      } else {
        logger.error('ffmpeg segment extraction failed');
        reject(new Error('ffmpeg segment extraction failed'));
      }
    });
    ffmpeg.on('error', (err) => {
      logger.error(err instanceof Error ? err.message : String(err));
      reject(err);
    });
  });
  const files = fs.readdirSync(segmentDir)
    .filter(f => f.endsWith('.jpg'))
    .map(f => path.join(segmentDir, f));
  logger.info('Segment files found', { files });
  return files;
}

// ...removed duplicate code...

export async function handleStoryboard(tmpVideoPath: string, blobServiceClient: BlobServiceClient, containerName: string, blobId: string): Promise<string[]> {
  logger.info('handleStoryboard: extracting segments', { tmpVideoPath, blobId });
  const segmentDir = path.join(os.tmpdir(), `${blobId}-segments`);
  const segmentPaths = await extractVideoSegments(tmpVideoPath, segmentDir);
  logger.info('handleStoryboard: segmentPaths', { segmentPaths });
  const gridSize = 4;
  const storyboardUrls: string[] = [];
  for (let i = 0; i < segmentPaths.length; i += gridSize * gridSize) {
    const gridImages = segmentPaths.slice(i, i + gridSize * gridSize);
    logger.info('Grid images for storyboard', { gridImages });
    // Use ESM-compatible path for blank.jpg
    const blankImagePath = path.resolve(process.cwd(), 'src/assets/blank.jpg');
    while (gridImages.length < gridSize * gridSize) {
      gridImages.push(blankImagePath);
    }
    logger.info('Final grid images (with blanks)', { gridImages });
    const imageBuffers = await Promise.all(gridImages.map(img => fs.promises.readFile(img)));
    logger.info('Loaded image buffers for grid', { count: imageBuffers.length });
    const composite: any[] = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        composite.push({ input: imageBuffers[y * gridSize + x], top: y * 320, left: x * 180 });
      }
    }
    const storyboardBuffer = await sharp({ create: { width: 180 * gridSize, height: 320 * gridSize, channels: 3, background: '#fff' } })
      .composite(composite)
      .jpeg()
      .toBuffer();
    const storyboardPath = path.join(os.tmpdir(), `${blobId}-storyboard-${i / (gridSize * gridSize)}.jpg`);
    fs.writeFileSync(storyboardPath, storyboardBuffer);
    const storyboardBlobName = `${blobId}-storyboard-${i / (gridSize * gridSize)}.jpg`;
    const storyboardBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(storyboardBlobName);
    await storyboardBlob.uploadFile(storyboardPath);
    logger.info('Uploaded storyboard to blob', { blobName: storyboardBlobName });
    storyboardUrls.push(storyboardBlob.url);
  }
  return storyboardUrls;
}
