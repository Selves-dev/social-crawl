import { logger } from '../../shared/logger';
import { buildAnalysisPrompt } from '../handlers/buildAnalysisPrompts';
import { sendToPostOffice } from '../../shared/postOffice/postman';
import { getBlobJson } from '../../shared/azureBlob';

export async function handleAnalyseMedia(message: PostOfficeMessage) {
  
  logger.info('handleAnalyseMedia called', { message });

  // Extract AnalyseMediaJob fields from PostOfficeMessage
  const workflow = message.workflow || {};
  const payload = message.payload || {};
  const mediaUrl = payload.mediaUrl;
  const blobUrl = payload.blobUrl;

  // Fetch blobJson from blobUrl
  let blobJson;
  if (blobUrl) {
    try {
      blobJson = await getBlobJson(blobUrl);
    } catch (err) {
      logger.warn('Failed to fetch blobJson from blobUrl', { error: (err as Error).message, blobUrl });
      blobJson = undefined;
    }
  }

  // Build analysis prompt
  const prompt = buildAnalysisPrompt(blobJson, workflow);

  logger.info('BuildAnalysisPrompt called. Preparing to send image/text analysis job to ai-service via postman');
  const postmanPayload = {
  util: 'ai-service',
  type: 'text-image',
    apiSecret: process.env['taash-secret'],
    workflow,
    payload: {
      prompt,
      mediaUrl: blobUrl,
      responseHandler: {
        util: 'analyse-media',
        type: 'am-response'
      }
    }
  };
  logger.debug('[handleAnalyseMedia] Full postman payload:', postmanPayload);
  // Send to ai-service via postal system (image/text only)
  await sendToPostOffice(postmanPayload);
  logger.info('Sent image/text analysis job to ai-service via postal system');
}
