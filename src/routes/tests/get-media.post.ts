import { defineEventHandler, readBody } from 'h3';
import { requireAuth } from '../../middleware/auth';
import { sendToPostOffice } from '../../utils/shared/postOffice/postman';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  console.info('[get-media test] Starting workflow test', { body });
  
  // Accept 'link' in the request body - this should be the URL to scrape
  const link = body?.link || 'https://www.tiktok.com/@kristinatraveltourism/video/7503102678512225542';
  const workflow = body?.workflow || { 
    batchId: 'test-batch', 
    stage: 'get-media', 
    timestamp: new Date().toISOString(), 
    l: "malaga",
    w: ['places to stay in malaga'],
    cc: 'ES'
  };
  
  // Test the get-media workflow - scrape media from URL and route to prep-media
  await sendToPostOffice({
    util: 'get-media',
    type: 'get-media',
    apiSecret: process.env['taash-secret'],
    workflow,
    payload: {
      link: link
    }
  });
  
  return { 
    status: 'ok', 
    message: 'get-media workflow message sent', 
    link: link,
    workflow 
  };
});
