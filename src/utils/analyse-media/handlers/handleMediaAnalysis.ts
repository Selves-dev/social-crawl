import { logger } from '../../shared/logger';
import { buildAnalysisPrompt } from './buildAnalysisPrompt';
import { analyseMediaLetterbox } from '../letterbox';
import { serviceBus } from '../../shared/serviceBus';

  logger.info('handleMediaAnalysis called', { message });
  try {
    // Ensure type is set
    if (!message.type) {
      message.type = 'handleMediaAnalysis';
    }

    // Build analysis prompt
    const prompt = buildAnalysisPrompt(message.blobJson, message.workflow);
    logger.info('Built analysis prompt', { prompt });

    // Send message to AI queue for analysis
    const aiQueueName = process.env["ASB-AI-QUEUE"] || 'ai-jobs';
    if (!serviceBus.isConnected()) {
      logger.error('Service bus not connected.');
      throw new Error('Service bus not connected.');
    }
    const sender = serviceBus.createQueueSender(aiQueueName);
    await sender.sendMessages({
      body: {
        type: 'handleAnalysisResponse',
        prompt,
        originalMessage: message
      },
      contentType: 'application/json',
      messageId: message.id || message.blobUrl,
    });
    logger.info('Sent analysis job to AI queue', { aiQueueName });
  } catch (err) {
    logger.error('Error in handleMediaAnalysis', err instanceof Error ? err : new Error(String(err)), { message });
    // Optionally: rethrow or handle error
  }
  // TODO: Handle AI response in handleAnalysisResponse
}
