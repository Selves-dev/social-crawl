

import { logger } from '../../shared/logger';
import { sendToPostOffice } from '../../shared/postOffice/postman';

/**
 * Handler for find-info jobs. Builds the prompt and sends it to the ai-service.
 * Expects message.workflow to contain venueName and venueLocation.
 */
export async function handleFindInfo(message: { util: string; type: string; workflow: { venueName: string; venueLocation: string; [key: string]: any }; payload: any }): Promise<void> {
  try {
    const { workflow } = message;
    logger.info('[find-info-request] Starting find-info request', {
      venueName: workflow?.venueName,
      venueLocation: workflow?.venueLocation
    });

    const { buildFindInfoPrompt } = await import('./buildFindInfoPrompt');
    const prompt = await buildFindInfoPrompt(workflow.venueName, workflow.venueLocation);

    await sendToPostOffice({
      util: 'ai-service',
      type: 'text',
      apiSecret: process.env['taash-secret'],
      workflow,
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
