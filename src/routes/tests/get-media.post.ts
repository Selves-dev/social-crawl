import { defineEventHandler, readBody } from 'h3';
import { requireAuth } from '../../middleware/auth';
import { sendToPostOffice } from '../../utils/shared/postOffice/postman';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  console.info('[get-media test] Starting workflow test', { body });
  
  // Accept 'link' in the request body - this should be the URL to scrape
  const link = body?.link || 'https://www.youtube.com/watch?v=Hmye8k6qJxg';
  const workflow = body?.workflow || { 
    batchId: 'test-batch', 
    stage: 'get-media', 
    timestamp: new Date().toISOString(), 
    l: 'ibiza',
    w: ['things to do in ibiza'],
    cc: 'Spain'
  };
  
  await sendToPostOffice({
    util: 'get-media',
    type: 'get-media',
    apiSecret: process.env['taash-secret'],
    workflow,
    payload: {
      link,
      requestedBy: 'test-user'
    }
  });
  
  return { 
    status: 'ok', 
    message: 'get-media workflow message sent', 
    link,
    workflow 
  };
});
