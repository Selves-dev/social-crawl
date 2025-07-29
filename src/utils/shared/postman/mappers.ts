
// Example stub: Replace with real handlers as needed


import { letterbox as findLocationLetterbox } from '../../find-location/letterbox';
import { letterbox as crawlMediaLetterbox } from '../../crawl-media/letterbox';

import { letterbox as aiServiceLetterbox } from '../../ai-service/letterbox'
// Remove broken type import for now, or replace with any
// import type { WorkflowContext } from '../workflowTracker'

// Generic util routing: expects { util, type, payload, context }
export const postmanMappers: Record<string, (payload: any, context: any) => Promise<any>> = {
  'find-location': async (payload, context) => {
    await findLocationLetterbox({
      type: payload.type,
      ...payload
    }, context);
  },
  'ai-service': async (payload, context) => {
    await aiServiceLetterbox({
      type: payload.type,
      ...payload
    }, context);
  },
  'crawl-media': async (payload, context) => {
    await crawlMediaLetterbox({
      type: payload.type,
      ...payload
    }, context);
  },
  'search-crawl': async (payload, context) => {
    await crawlMediaLetterbox({
      type: payload.type,
      ...payload
    }, context);
  }
};
