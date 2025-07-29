import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import sharp from 'sharp';
import { BlobServiceClient } from '@azure/storage-blob';
import { logger } from '../../shared/logger';

export async function extractVideoSegments(tmpVideoPath: string, segmentDir: string): Promise<string[]> {
  fs.mkdirSync(segmentDir, { recursive: true });
  await new Promise((resolve, reject) => {
    const ffmpeg = require('child_process').spawn('ffmpeg', [
      '-i', tmpVideoPath,
      '-vf', 'fps=1/2,scale=720:1280',
      path.join(segmentDir, 'segment-%02d.jpg')
    ]);
    ffmpeg.on('close', (code: number) => {
      if (code === 0) {
        logger.info('Extracted video segments', { segmentDir });
        resolve(true);
      } else {
        reject(new Error('ffmpeg segment extraction failed'));
      }
    });
    ffmpeg.on('error', reject);
  });
  return fs.readdirSync(segmentDir)
    .filter(f => f.endsWith('.jpg'))
    .map(f => path.join(segmentDir, f));
}

export async function handleStoryboard(segmentPaths: string[], blobServiceClient: BlobServiceClient, containerName: string, blobId: string): Promise<string[]> {
  const gridSize = 4;
  const storyboardUrls: string[] = [];
  for (let i = 0; i < segmentPaths.length; i += gridSize * gridSize) {
    const gridImages = segmentPaths.slice(i, i + gridSize * gridSize);
    while (gridImages.length < gridSize * gridSize) {
      gridImages.push(path.join(__dirname, 'blank.jpg'));
    }
    const imageBuffers = await Promise.all(gridImages.map(img => fs.promises.readFile(img)));
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
