import { logger } from '../../shared/logger';
import { buildAnalysisPrompt } from '../handlers/buildAnalysisPrompts';
import { sendToPostOffice } from '../../shared/postOffice/router';
import { getBlobJson } from '../../shared/azureBlob';
import type { AnalyseMediaJob } from '../../shared/types';

export async function handleAnalyseMedia(message: AnalyseMediaJob) {
  logger.info('handleAnalyseMedia called', { message });

  // Ensure workflow and mediaUrl are defined
  const workflow = message.workflow || {};
  const mediaUrl = message.mediaUrl;

  // Fetch blobJson from blobUrl
  let blobJson;
  if (message.blobUrl) {
    try {
      blobJson = await getBlobJson(message.blobUrl);
    } catch (err) {
      logger.warn('Failed to fetch blobJson from blobUrl', { error: (err as Error).message, blobUrl: message.blobUrl });
      blobJson = undefined;
    }
  }

  // Build analysis prompt
  const prompt = buildAnalysisPrompt(blobJson, workflow);
  logger.info('buildAnalysisPrompt called');

  logger.info('Preparing to send image/text analysis job to ai-service via postman');
  const postmanPayload = {
    util: 'ai-service',
    type: 'text-image',
    workflow,
    payload: {
      prompt,
      mediaUrl: message.blobUrl,
      responseHandler: {
        util: 'analyse-media',
        type: 'ai_response'
      }
    }
  };
  logger.info('[handleAnalyseMedia] Full postman payload:', postmanPayload);
  // Send to ai-service via postal system (image/text only)
  await sendToPostOffice(postmanPayload);
  logger.info('Sent image/text analysis job to ai-service via postal system');
}
