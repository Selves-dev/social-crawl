import { defineEventHandler, readBody } from 'h3';
import { requireAuth } from '../../middleware/auth';
import { sendToPostOffice } from '../../utils/shared/postOffice/postman';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  console.info('[get-media test] Starting workflow test', { body });
  
  // Accept 'link' in the request body - this should be the URL to scrape
  const link = body?.link || 'https://www.instagram.com/reel/DKPwBiyslt3/';
  const workflow = body?.workflow || { 
    batchId: 'test-batch', 
    stage: 'get-media', 
    timestamp: new Date().toISOString(), 
    l: 'norwich',
    w: ['things to do in norwich'],
    cc: 'Uk'
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
