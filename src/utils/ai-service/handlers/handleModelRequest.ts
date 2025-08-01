import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { Buffer } from 'buffer';
import axios from 'axios'
import { logger } from '../../shared/logger'
import { getBlobJson } from '../../shared/azureBlob'
import type { BlobManifest } from '../../shared/types'

function getAzureOpenAIConfig() {
  const endpoint = process.env["AZURE-OPENAI-ENDPOINT"]?.replace(/\/$/, '')
  const deployment = process.env["AZURE-OPENAI-DEPLOYMENT"]
  const apiKey = process.env["AZURE-OPENAI-API-KEY"]
  const apiVersion = process.env["AZURE-OPENAI-API-VERSION"]
  const temperature = parseFloat(process.env["AZURE-OPENAI-TEMPERATURE"] || '0.25')

  if (!endpoint || !deployment || !apiKey || !apiVersion) {
    logger.error(`[getAzureOpenAIConfig] Missing Azure OpenAI config: endpoint=${endpoint}, deployment=${deployment}, apiKey=${!!apiKey}, apiVersion=${apiVersion}`);
    throw new Error('Azure OpenAI config missing')
  }

  return { endpoint, deployment, apiKey, apiVersion, temperature }
}

async function buildMessageContent(prompt: string, mediaUrl?: string): Promise<any[]> {
  async function compressAudio(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const inputStream = new Readable();
      inputStream.push(buffer);
      inputStream.push(null);

      const chunks: Buffer[] = [];
      ffmpeg(inputStream)
        .audioBitrate('64k') // Lower bitrate for compression
        .format('mp3')
        .on('error', reject)
        .on('end', () => resolve(Buffer.concat(chunks)))
        .pipe()
        .on('data', chunk => chunks.push(chunk));
    });
  }
  async function fetchAndEncodeAudio(url: string): Promise<string | null> {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      if (res.status !== 200) {
        logger.warn(`[fetchAndEncodeAudio] Failed to fetch audio, skipping: ${url}`);
        return null;
      }
      const originalBuffer = Buffer.from(res.data);
      // Compress audio before encoding
      const compressedBuffer = await compressAudio(originalBuffer);
      const base64 = compressedBuffer.toString('base64');
      if (!base64) {
        logger.warn(`[fetchAndEncodeAudio] Failed to encode audio, skipping: ${url}`);
        return null;
      }
      return base64;
    } catch (err) {
      logger.error(`[fetchAndEncodeAudio] Failed to fetch or encode audio for url: ${url}`, err as Error);
      return null;
    }
  }
  const content: any[] = [];
  content.push({ type: 'text', text: prompt });

  if (!mediaUrl) {
    logger.warn('[buildMessageContent] No mediaUrl provided, returning text-only content');
    return content;
  }

  try {
    logger.info('[buildMessageContent] Fetching blobJson for mediaUrl:', { mediaUrl });
    const blobJson = await getBlobJson(mediaUrl) as BlobManifest;
    logger.info('[buildMessageContent] blobJson fetched:', { blobJson });
    const media = blobJson?.media || [];
    logger.info('[buildMessageContent] Extracted media array:', { media });

    for (const item of media) {
      logger.info('[buildMessageContent] Inspecting media item:', { item });

      if (!item.url) {
        logger.warn('[buildMessageContent] Item missing url:', { item });
        continue;
      }

      const type = item.type?.toLowerCase();
      const urls = (type === 'storyboards' && item.url.includes(','))
        ? item.url.split(',').map(u => u.trim())
        : [item.url];

      for (const url of urls) {
        const isImage = isImageUrl(url);
        const isAudio = url.toLowerCase().endsWith('.mp3') || url.toLowerCase().endsWith('.wav') || url.toLowerCase().endsWith('.aac');
        const isVideo = url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.mov') || url.toLowerCase().endsWith('.webm');

        logger.info('[buildMessageContent] File type check:', { url, type, isImage, isAudio, isVideo });

        if (isImage || type === 'image' || type === 'thumbnail' || type === 'storyboards') {
          logger.info('[buildMessageContent] Adding image_url to content:', { url, type });
          content.push({ type: 'image_url', image_url: { url } });
        } else {
          logger.info('[buildMessageContent] Skipping unsupported, audio, or video file type:', { url, type });
        }
      }
    }
  } catch (err) {
    logger.error('[buildMessageContent] Error fetching or parsing blobJson:', err as Error);
  }

  logger.info('[buildMessageContent] Final content:', { content });
  return content;
}



async function fetchOpenAIResponse(
  messages: any[],
  options: { maxTokens?: number }
): Promise<any> {
  const { endpoint, deployment, apiKey, apiVersion, temperature } = getAzureOpenAIConfig()
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

  const body = {
    messages,
    temperature,
    max_tokens: options.maxTokens || 4096
  }

  const response = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    }
  });
  const data = response.data as any;
  const text = data.choices?.[0]?.message?.content || ''

  return {
    text,
    model: deployment,
    success: !!text,
    raw: data
  }
}

export async function handleTextRequest(msg: any): Promise<any> {
  const messages = [{ role: 'user', content: msg.prompt }]
  return fetchOpenAIResponse(messages, msg.options || {})
}

export async function handleTextImageRequest(msg: any): Promise<any> {
  const content = await buildMessageContent(msg.prompt, msg.mediaUrl)
  const messages = [{ role: 'user', content }]
  return fetchOpenAIResponse(messages, msg.options || {})
}

export async function handleTextAudioRequest(msg: any): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return {
    text: 'Simulated multimodal (text+audio) response',
    model: 'azure-gpt-multimodal',
    success: true
  }
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.bmp'
  ].some(ext => lowerUrl.includes(ext));
}
