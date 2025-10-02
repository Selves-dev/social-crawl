import { defineEventHandler, readBody } from 'h3';
import { requireAuth } from '../../middleware/auth';
import { sendToPostOffice } from '../../utils/shared/postOffice/postman';

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  console.info('[enrich-static test] Starting workflow test', { body });

  const workflow = body?.workflow || { batchId: 'test-batch', stage: 'enrich-static', timestamp: new Date().toISOString() };
  // Use the provided _id or default to the example
  const _id = body?._id || '68a4ac0041347535d8a392b9';

  await sendToPostOffice({
    util: 'enrich-static',
    type: 'enrich-static-request',
    workflow,
    apiSecret: process.env['taash-secret'],
    payload: {
      _id
    }
  });
  return { status: 'ok', message: 'enrich-static workflow message sent', _id };
});
