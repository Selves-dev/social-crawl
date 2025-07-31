// Example stub: Replace with real handlers as needed



import { letterbox as findLocationLetterbox } from '../../find-location/letterbox';
import { letterbox as crawlMediaLetterbox } from '../../crawl-media/letterbox';
import { letterbox as aiServiceLetterbox } from '../../ai-service/letterbox';
import { letterbox as prepMediaLetterbox } from '../../prep-media/letterbox';
import { letterbox as analyseMediaLetterbox } from '../../analyse-media/letterbox';
// ...existing code...


// Generic util routing: expects { util, type, payload, context }
export const postmanMappers: Record<string, (payload: any, context: any) => Promise<any>> = {
  'find-location': async (payload, context) => {
    await findLocationLetterbox({
      type: 'find-location',
      ...payload,
      workflow: context
    });
  },
  'ai-service': async (payload, context) => {
    await aiServiceLetterbox({
      type: 'ai-service',
      ...payload,
      workflow: context
    });
  },
  'crawl-media': async (payload, context) => {
    await crawlMediaLetterbox({
      type: 'crawl-media',
      ...payload,
      workflow: context
    });
  },
  'prep-media': async (payload, context) => {
    await prepMediaLetterbox({
      type: 'prep-media',
      ...payload,
      workflow: context
    });
  },
  'analyse-media': async (payload, context) => {
    await analyseMediaLetterbox({
      type: 'analyse-media',
      ...payload,
      workflow: context
    });
  }
};
