import { logger } from '../../shared/logger';
import { serviceBus } from '../../shared/serviceBus';

export async function handleAnalysisResponse(message: any) {
  logger.info('handleAnalysisResponse called', { message });
  try {
    // Check for blobJson and media
    const blobJson = message.blobJson || message.originalMessage?.blobJson;
    const workflow = message.workflow || message.originalMessage?.workflow;
    if (!blobJson || !blobJson.media) {
      logger.warn('No blobJson.media found in message', { message });
      return;
    }

    // Prepare image and audio messages
    const imageFiles: string[] = [];
    const audioFiles: string[] = [];
    if (blobJson.media.storyboards && Array.isArray(blobJson.media.storyboards)) {
      imageFiles.push(...blobJson.media.storyboards);
    }
    if (blobJson.media.audio) {
      audioFiles.push(blobJson.media.audio);
    }

    // Build prompts
    const imagePrompt = `Analyse the following images for insights.\nWorkflow: ${JSON.stringify(workflow, null, 2)}`;
    const audioPrompt = `Analyse the following audio for insights.\nWorkflow: ${JSON.stringify(workflow, null, 2)}`;

    // Send image analysis message to AI model
    if (imageFiles.length > 0) {
      await sendAiMessage({
        type: 'image',
        prompt: imagePrompt,
        blobJson
      });
      logger.info('Sent image analysis message to AI model', { imageFiles, message });
    }

    // Send audio analysis message to AI model (dummy for now)
    if (audioFiles.length > 0) {
      await sendAiMessage({
        type: 'audio',
        prompt: audioPrompt,
        blobJson,
        dummy: true // Indicate dummy handling for now
      });
      logger.info('Sent audio analysis message to AI model (dummy)', { audioFiles, message });
    }
  } catch (err) {
    logger.error('Error in handleAnalysisResponse', err instanceof Error ? err : new Error(String(err)), { message });
    // Optionally: rethrow or handle error
  }
  // TODO: Handle AI response routing based on type
// ...existing code...
}

// Helper to send message to AI queue
async function sendAiMessage(aiMessage: any) {
  const aiQueueName = process.env["ASB-AI-QUEUE"] || 'ai-jobs';
  if (!serviceBus.isConnected()) {
    logger.error('Service bus not connected.');
    throw new Error('Service bus not connected.');
  }
  const sender = serviceBus.createQueueSender(aiQueueName);
  await sender.sendMessages({
    body: aiMessage,
    contentType: 'application/json',
    messageId: aiMessage.blobJson?.id || aiMessage.blobJson?.blobUrl || 'ai-message',
  });
  logger.info('Sent AI message to queue', { aiQueueName, aiMessage });
}
