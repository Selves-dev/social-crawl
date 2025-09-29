import { defineEventHandler, readBody } from 'h3';
import { requireAuth } from '../../middleware/auth';
import { sendToPostOffice } from '../../utils/shared/postOffice/postman';


export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  console.info('[analyse-media test] Starting workflow test', { body });
  // Accept 'blobPath' in the request body, e.g. 'youtube/json/oDBrHUXWVtw/1754125875587.json'
  const blobPath = body?.blobPath || 'tiktok/json/7531090473729953046/tiktok-7531090473729953046-20250818101137349-group-0.json';
  const baseUrl = 'https://socialcrawlstorage.blob.core.windows.net/media/';
  const mediaUrl = `${baseUrl}${blobPath}`;
  const workflow = body?.workflow || {
    batchId: 'test-batch',
    stage: 'analyse-media',
    timestamp: new Date().toISOString(),
    l: 'nice',
    w: ['places to stay in Nice'],
    cc: 'france'
  };
  // Always include mediaUrl and blobUrl in the payload
  await sendToPostOffice({
    util: 'analyse-media',
    type: 'analyse-media',
    apiSecret: process.env['taash-secret'],
    workflow,
    payload: {
      blobUrl: mediaUrl,
      mediaUrl: body?.mediaUrl || mediaUrl,
    }
  });
  return { status: 'ok', message: 'analyse-media workflow message sent', mediaUrl: body?.mediaUrl || mediaUrl };
});
