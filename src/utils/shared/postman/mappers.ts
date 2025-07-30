// Example stub: Replace with real handlers as needed



import { letterbox as findLocationLetterbox } from '../../find-location/letterbox';
import { letterbox as crawlMediaLetterbox } from '../../crawl-media/letterbox';
import { letterbox as aiServiceLetterbox } from '../../ai-service/letterbox';
import { letterbox as prepMediaLetterbox } from '../../prep-media/letterbox';
import { letterbox as analyseMediaLetterbox } from '../../analyse-media/letterbox';
import { logger } from '../logger';


// Generic util routing: expects { util, type, payload, context }
export const postmanMappers: Record<string, (payload: any, context: any) => Promise<any>> = {
  'find-location': async (payload, context) => {
    logger.info('[postmanMappers] Routing to find-location', { payload, context });
    await findLocationLetterbox({
      type: 'find-location',
      ...payload
    }, context);
  },
  'ai-service': async (payload, context) => {
    logger.info('[postmanMappers] Routing to ai-service', { payload, context });
    await aiServiceLetterbox({
      type: 'ai-service',
      ...payload
    }, context);
  },
  'crawl-media': async (payload, context) => {
    logger.info('[postmanMappers] Routing to crawl-media', { payload, context });
    await crawlMediaLetterbox({
      type: 'crawl-media',
      ...payload
    }, context);
  },
  'prep-media': async (payload, context) => {
    logger.info('[postmanMappers] Routing to prep-media', { payload, context });
    await prepMediaLetterbox({
      type: 'prep-media',
      ...payload
    });
  },
  'analyse-media': async (payload, context) => {
    logger.info('[postmanMappers] Routing to analyse-media', { payload, context });
    await analyseMediaLetterbox({
      type: 'analyse-media',
      ...payload
    }, context);
  }
};
