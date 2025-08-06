import { defineEventHandler, readBody } from 'h3';
import { requireAuth } from '../../middleware/auth';
import { sendToPostOffice } from '../../utils/shared/postOffice/postman';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  console.info('[prep-media test] Starting workflow test', { body });
  // Accept 'blobPath' in the request body, e.g. 'youtube/json/d_1qcZb-S80/1753983592882.json'
  const blobPath = body?.blobPath || 'tiktok/json/7338157339985464609/1754410487156.json';
  const baseUrl = 'https://socialcrawlstorage.blob.core.windows.net/media/';
  const mediaUrl = `${baseUrl}${blobPath}`;
  const workflow = body?.workflow || { batchId: 'test-batch', stage: 'prep-media', timestamp: new Date().toISOString() };
  // Always include mediaUrl in the payload so it can override the blob's media link if needed
  await sendToPostOffice({
    util: 'prep-media',
    type: 'prep-media',
    apiSecret: process.env['taash-secret'],
    workflow,
    payload: {
      blobUrl: mediaUrl,
      mediaUrl: body?.mediaUrl || mediaUrl
    }
  });
  return { status: 'ok', message: 'prep-media workflow message sent', mediaUrl: body?.mediaUrl || mediaUrl };
});
