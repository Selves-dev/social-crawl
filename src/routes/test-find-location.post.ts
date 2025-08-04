import { defineEventHandler, readBody } from 'h3';
import { findLocationLetterbox } from '../utils/find-location/letterbox';


export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  // Log the incoming request body for debugging
  // eslint-disable-next-line no-console
  console.log('[test-find-location] Incoming request body:', JSON.stringify(body, null, 2));

  // Standardize message shape: { type, workflow, payload }
  const { type, workflow, ...payload } = body;
  const message = {
    type: type || 'find-location-request',
    workflow: workflow || {},
    payload
  };

  // Pass the standardized message to the letterbox
  const result = await findLocationLetterbox(message);
  // eslint-disable-next-line no-console
  console.log('[test-find-location] Letterbox result:', JSON.stringify(result, null, 2));
  return { status: 'test-find-location-completed', result };
});
