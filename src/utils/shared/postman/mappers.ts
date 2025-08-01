// Example stub: Replace with real handlers as needed



import { findLocationLetterbox } from '../../find-location/letterbox';
import { crawlMediaLetterbox } from '../../crawl-media/letterbox';
import { aiServiceLetterbox } from '../../ai-service/letterbox';
import { prepMediaLetterbox } from '../../prep-media/letterbox';
import { analyseMediaLetterbox } from '../../analyse-media/letterbox';


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
