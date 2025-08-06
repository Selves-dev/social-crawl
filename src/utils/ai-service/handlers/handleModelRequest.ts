import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { Buffer } from 'buffer';
import axios from 'axios';
import { logger } from '../../shared/logger';
import { getBlobJson } from '../../shared/azureBlob';
import type { BlobManifest } from '../../shared/types';

// Types
interface AIRequest {
  prompt: string;
  mediaUrl?: string;
  options?: {
    maxTokens?: number;
  };
}

interface AIResponse {
  text?: string;
  model?: string;
  success: boolean;
  error?: boolean;
  message?: string;
  raw?: any;
  mediaUrl?: string;
}

// Main request handlers
export async function handleTextRequest(msg: any): Promise<AIResponse> {
  try {
    logger.info('[handleTextRequest] Processing text request');
    const aiReq: AIRequest = msg.payload || msg; // Accept either PostOfficeMessage or AIRequest
    logger.debug('[handleTextRequest] Received AIRequest', { aiReq });
    const messages = [{ role: 'user', content: aiReq.prompt }];
    const aiResponse = await fetchOpenAIResponse(messages, aiReq.options || {});
    
    // Add mediaUrl to the AI response and include the original message
    return aiResponse;
  } catch (error) {
    logger.error('[handleTextRequest] Error processing text request:', error as Error);
    return createErrorResponse(error);
  }
}

export async function handleTextImageRequest(msg: any): Promise<AIResponse> {
  try {
    logger.debug('[handleTextImageRequest] Processing text+image request', { msg });
    const aiReq: AIRequest = msg.payload || msg;
    const content = await buildMessageContent(aiReq.prompt, aiReq.mediaUrl);
    const messages = [{ role: 'user', content }];
    return await fetchOpenAIResponse(messages, aiReq.options || {});
  } catch (error) {
    logger.error('[handleTextImageRequest] Error processing text+image request:', error as Error);
    return createErrorResponse(error);
  }
}

export async function handleTextAudioRequest(msg: AIRequest): Promise<AIResponse> {
  try {
    logger.info('[handleTextAudioRequest] Processing text+audio request');
    
    // TODO: Implement actual audio processing when ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      text: 'Audio processing not yet implemented',
      model: 'azure-gpt-multimodal',
      success: true
    };
    
  } catch (error) {
    logger.error('[handleTextAudioRequest] Error processing text+audio request:', error as Error);
    return createErrorResponse(error);
  }
}

// Core OpenAI API interaction
async function fetchOpenAIResponse(messages: any[], options: { maxTokens?: number }): Promise<AIResponse> {
  try {
    const config = getAzureOpenAIConfig();
    const url = `${config.endpoint}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;

    logger.info('[AI Request] Making AI request');

    const requestBody = {
      messages,
      temperature: config.temperature,
      max_tokens: options.maxTokens || 4096
    };

    logger.debug('[fetchOpenAIResponse] Making API request', { 
      url: url.replace(/api-key=[^&]+/, 'api-key=***'),
      messageCount: messages.length 
    });

    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      timeout: 30000 // 30 second timeout
    });

    const data = response.data;
    logger.debug('[fetchOpenAIResponse] API response', { data });
    const text = data.choices?.[0]?.message?.content || '';

    if (!text) {
      logger.warn('[fetchOpenAIResponse] No content in API response', { data });
    }

    return {
      text,
      raw: data,
      success: !!text
    };

  } catch (error) {
    logger.error('[fetchOpenAIResponse] API request failed:', error instanceof Error ? error : undefined);
    throw error;
  }
}

// Message content builder for multimodal requests
async function buildMessageContent(prompt: string, mediaUrl?: string): Promise<any[]> {
  const content: any[] = [{ type: 'text', text: prompt }];

  if (!mediaUrl) {
    logger.debug('[buildMessageContent] No mediaUrl provided, returning text-only content');
    return content;
  }

  try {
    logger.debug('[buildMessageContent] Fetching media manifest', { mediaUrl });
    
    const blobJson = await getBlobJson(mediaUrl) as BlobManifest;
    const media =  blobJson?.media || [];

    logger.info('[buildMessageContent] Processing media items', { count: media.length });

    for (const item of media) {
      if (!item.url) {
        logger.warn('[buildMessageContent] Skipping item without URL', { item });
        continue;
      }

      const urls = getUrlsFromItem(item);
      
      for (const url of urls) {
        if (isImageUrl(url) || isImageType(item.type)) {
          logger.debug('[buildMessageContent] Adding image to content', { url, type: item.type });
          content.push({ 
            type: 'image_url', 
            image_url: { url } 
          });
        } else {
          logger.debug('[buildMessageContent] Skipping non-image media', { url, type: item.type });
        }
      }
    }

  } catch (error) {
    logger.error('[buildMessageContent] Error processing media manifest:', error as Error);
    // Continue with text-only content rather than failing completely
  }

  logger.info('[buildMessageContent] Content built', { 
    totalItems: content.length,
    hasImages: content.some(item => item.type === 'image_url')
  });

  return content;
}

// Utility functions
function getUrlsFromItem(item: any): string[] {
  if (!item.url) return [];
  
  // Handle comma-separated URLs (e.g., storyboards)
  if (item.type?.toLowerCase() === 'storyboards' && item.url.includes(',')) {
    return item.url.split(',').map((u: string) => u.trim()).filter(Boolean);
  }
  
  return [item.url];
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const lowerUrl = url.toLowerCase();
  
  return imageExtensions.some(ext => lowerUrl.includes(ext));
}

function isImageType(type?: string): boolean {
  if (!type) return false;
  
  const imageTypes = ['image', 'thumbnail', 'storyboards'];
  return imageTypes.includes(type.toLowerCase());
}

function createErrorResponse(error: unknown): AIResponse {
  const message = error instanceof Error ? error.message : String(error);
  
  return {
    error: true,
    message,
    model: undefined,
    success: false
  };
}

// Configuration helper (assumes this exists elsewhere)
function getAzureOpenAIConfig() {
  // This should be implemented based on your configuration setup
  return {
    endpoint: process.env['azure-openai-endpoint'] || '',
    deployment: process.env['azure-openai-deployment'] || '',
    apiKey: process.env['azure-openai-api-key'] || '',
    apiVersion: process.env['azure-openai-api-version'] || '2024-02-15-preview',
    temperature: 0.7
  };
}

// Audio compression utility (kept for future use)
async function compressAudio(buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(buffer);
    inputStream.push(null);

    const chunks: Buffer[] = [];
    
    ffmpeg(inputStream)
      .audioBitrate('64k')
      .format('mp3')
      .on('error', (error) => {
        logger.error('[compressAudio] FFmpeg error:', error as Error);
        reject(error);
      })
      .on('end', () => {
        logger.info('[compressAudio] Compression completed', { 
          originalSize: buffer.length,
          compressedSize: Buffer.concat(chunks).length 
        });
        resolve(Buffer.concat(chunks));
      })
      .pipe()
      .on('data', (chunk: Buffer) => chunks.push(chunk));
  });
}