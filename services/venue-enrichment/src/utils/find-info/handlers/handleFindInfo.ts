
import { logger } from '../../shared/logger';
import { sendToPostOffice } from '../../shared/postOffice/postman';

/**
 * Handler for find-info jobs. Builds the prompt and sends it to the ai-service.
 * Expects message.workflow to contain venueName and venueLocation.
 */
export async function handleFindInfo(workflowContext: { venueName: string; venueLocation: string; [key: string]: any }): Promise<void> {
  try {
    logger.info('[find-info-request] Starting find-info request', {
      venueName: workflowContext?.venueName,
      venueLocation: workflowContext?.venueLocation
    });

    const { buildFindInfoPrompt } = await import('./buildFindInfoPrompt');
    const prompt = await buildFindInfoPrompt(workflowContext.venueName, workflowContext.venueLocation);

    await sendToPostOffice({
      util: 'ai-service',
      type: 'text',
      apiSecret: process.env['taash-secret'],
      workflow: workflowContext,
      payload: {
        prompt,
        responseHandler: {
          util: 'find-info',
          type: 'find-info-response'
        }
      }
    });

    logger.info('[find-info-request] Find-info request completed');
  } catch (error) {
    logger.error('[find-info-request] Failed to process find-info request',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}
