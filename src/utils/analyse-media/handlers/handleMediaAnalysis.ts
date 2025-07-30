

export async function handleAnalyseMedia(message: any) {
  logger.info('handleAnalyseMedia called', { message });
  try {
    // Ensure type is set
    if (!message.type) {
      message.type = 'analyse-media';
    }

    // Ensure workflow is always defined
    const workflow = message.workflow || {};

    // Build analysis prompt
    const prompt = buildAnalysisPrompt(message.blobJson, workflow);
    logger.info('Built analysis prompt', { prompt });

    // Send to ai-service via postman (image/text only)
    await sendPostmanMessage({
      util: 'ai-service',
      payload: {
        type: 'ai_request',
        prompt,
        mediaUrl,
        workflow,
        responseHandler: message.responseHandler || null
      }
    });
    logger.info('Sent image/text analysis job to ai-service via postman', { mediaUrl });
  } catch (err) {
    logger.error('Error in handleAnalyseMedia: ' + (err instanceof Error ? err.message : String(err)));
    // Optionally: rethrow or handle error
  }
}
