
import { logger } from '../../shared/logger';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';
import sharp from 'sharp';
import { compressStoryboardImage } from '../../shared/downloadUtils';
import { BlobServiceClient } from '@azure/storage-blob';
import { generateBlobSasUrl } from '../../shared/azureBlob';
import { getBlobServiceClient } from '../../shared/azureBlob';


export async function handleStoryboard(
  tmpVideoPath: string,
  containerName: string,
  assetBaseName: string,
  platform: string,
  videoUrl?: string,
  originalBlobJson?: any
): Promise<string[]> {
  const blobServiceClient = getBlobServiceClient();
  if (!blobServiceClient) {
    throw new Error('Missing Azure Storage connection string');
  }
  // Detect isShorts for YouTube
  let isShorts = false;
  if (platform === 'youtube' && videoUrl && videoUrl.includes('/shorts/')) {
    isShorts = true;
  }

  logger.info('handleStoryboard: extracting segments');
  // Use dynamic dimensions
  const { width: thumbWidth, height: thumbHeight } = getOutputDimensions(platform, isShorts);
  const segmentDir = path.join(os.tmpdir(), `${assetBaseName}-segments`);
  const segmentPaths = await extractVideoSegments(tmpVideoPath, segmentDir);
  logger.debug('handleStoryboard: segmentPaths', { segmentPaths });

  // Compress each extracted frame for storyboard
  const compressedDir = path.join(os.tmpdir(), `${assetBaseName}-segments-compressed`);
  fs.mkdirSync(compressedDir, { recursive: true });
  const compressedSegmentPaths: string[] = [];
  for (const framePath of segmentPaths) {
    const frameName = path.basename(framePath);
    const compressedPath = path.join(compressedDir, frameName);
    await compressStoryboardImage(framePath, compressedPath, { width: thumbWidth, height: thumbHeight, quality: 70 });
    compressedSegmentPaths.push(compressedPath);
  }
  const gridSize = 4;
  const blankImagePath = path.resolve(process.cwd(), 'src/assets/blank.jpg');
  const storyboardUrls: string[] = [];
  for (let i = 0; i < compressedSegmentPaths.length; i += gridSize * gridSize) {
    // Get up to gridSize*gridSize images for this grid
    const gridImages = compressedSegmentPaths.slice(i, i + gridSize * gridSize);
    // Pad with blank frames if needed
    while (gridImages.length < gridSize * gridSize) {
      gridImages.push(blankImagePath);
    }
    logger.debug('Final grid images (with blanks)', { gridImages });
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
    logger.debug('Uploaded storyboard to blob', { blobName: storyboardBlobName });
    const storyboardSasUrl = await generateBlobSasUrl(storyboardBlob);
    storyboardUrls.push(storyboardSasUrl);
  }
  
  // Split storyboard URLs into groups of 8 and create new blob JSONs
  function chunkArray(arr: string[], size: number): string[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );
  }
  
  const storyboardGroups = chunkArray(storyboardUrls, 8);
  const groupBlobUrls: string[] = [];
  
  // Create a new blob JSON for each storyboard group
  if (originalBlobJson) {
    for (let i = 0; i < storyboardGroups.length; i++) {
      const group = storyboardGroups[i];
      // Prepare media array, filter out old storyboards
      let mediaArr = [
        ...(originalBlobJson.media || []).filter((m: any) => m.type !== 'storyboards')
      ];
      // Add thumbnail as a media item if present and not already in media
      if (originalBlobJson.thumbnail && !mediaArr.some((m: any) => m.type === 'thumbnail')) {
        mediaArr.push({ type: 'thumbnail', url: originalBlobJson.thumbnail });
      }
      // Add this group's storyboards
      mediaArr.push({ type: 'storyboards', url: group.join(',') });
      // Create new blob JSON with this group's storyboards and thumbnail
      const groupBlobJson = {
        ...originalBlobJson,
        media: mediaArr
      };
      // Debug: Log the group blob JSON to see what fields are preserved
      logger.debug('[handleStoryboard] Group blob JSON fields', {
        groupIndex: i,
        mediaId: groupBlobJson.mediaId,
        id: groupBlobJson.id,
        permalink: groupBlobJson.permalink,
        link: groupBlobJson.link,
        platform: groupBlobJson.platform,
        source: groupBlobJson.source,
        hasOriginalBlobJson: !!originalBlobJson,
        originalKeys: originalBlobJson ? Object.keys(originalBlobJson) : []
      });
      // Upload the group blob JSON
      const groupBlobName = `${assetBaseName}-group-${i}.json`;
      const groupBlob = blobServiceClient.getContainerClient(containerName).getBlockBlobClient(groupBlobName);
      await groupBlob.upload(JSON.stringify(groupBlobJson, null, 2), JSON.stringify(groupBlobJson, null, 2).length, {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      });
      const groupBlobUrl = await generateBlobSasUrl(groupBlob);
      groupBlobUrls.push(groupBlobUrl);
      logger.debug('Created group blob JSON', { 
        groupIndex: i, 
        groupSize: group.length, 
        blobName: groupBlobName,
        blobUrl: groupBlobUrl
      });
    }
  }
  
  logger.info('Split storyboards into groups and created blob JSONs', { 
    totalStoryboards: storyboardUrls.length, 
    groups: storyboardGroups.length,
    groupBlobUrls: groupBlobUrls.length
  });
  
  return groupBlobUrls;
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


export async function extractVideoSegments(tmpVideoPath: string, segmentDir: string): Promise<string[]> {
  
  logger.debug('Creating segment directory', { segmentDir });
  fs.mkdirSync(segmentDir, { recursive: true });
  // Ensure blank image exists
  const blankImagePath = path.resolve(process.cwd(), 'src/assets/blank.jpg');
  if (!fs.existsSync(blankImagePath)) {
    logger.info('Creating blank image', { blankImagePath });
    // Use ffmpeg to create a blank white image 180x320
    const { spawnSync } = await import('child_process');
    const blankArgs = ['-f', 'lavfi', '-i', 'color=c=white:s=180x320', '-frames:v', '1', blankImagePath];
    logger.info('Spawning ffmpeg for blank image', { blankImagePath, blankArgs });
    const blankResult = spawnSync('ffmpeg', blankArgs);
    logger.info('ffmpeg blank image result', { status: blankResult.status, error: blankResult.error, stdout: blankResult.stdout?.toString(), stderr: blankResult.stderr?.toString() });
  }
  const ffmpegArgs = [
    '-hide_banner', '-loglevel', 'error',
    '-i', tmpVideoPath,
    '-vf', 'fps=1/2',
    path.join(segmentDir, 'frame_%03d.jpg')
  ];
  logger.info('Spawning ffmpeg for segment extraction', { tmpVideoPath, segmentDir, ffmpegArgs, exists: fs.existsSync(tmpVideoPath), fileSize: fs.existsSync(tmpVideoPath) ? fs.statSync(tmpVideoPath).size : null });
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stdout.on('data', (data) => logger.info('ffmpeg stdout', { data: data.toString() }));
    ffmpeg.stderr.on('data', (data) => logger.info('ffmpeg stderr', { data: data.toString() }));
    ffmpeg.on('close', (code: number) => {
      logger.info('ffmpeg process closed', { code });
      if (code === 0) {
        logger.info('Extracted video segments', { segmentDir });
        resolve(true);
      } else {
        logger.error(`ffmpeg segment extraction failed (code ${code})`);
        logger.debug('ffmpeg segment extraction failed context', { tmpVideoPath, segmentDir, ffmpegArgs });
        logger.debug('ffmpeg context', { tmpVideoPath, segmentDir, ffmpegArgs });
        reject(new Error('ffmpeg segment extraction failed'));
      }
    });
    ffmpeg.on('error', (err) => {
      logger.error(`ffmpeg process error: ${err instanceof Error ? err.message : String(err)}`);
      logger.debug('ffmpeg process error context', { tmpVideoPath, segmentDir, ffmpegArgs });
      logger.debug('ffmpeg context', { tmpVideoPath, segmentDir, ffmpegArgs });
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
    logger.warn('No frames extracted from video', { tmpVideoPath, segmentDir, ffmpegArgs, segmentDirFiles: fs.readdirSync(segmentDir) });
  }
  logger.debug('Segment files found', { files });
  return files;
}
