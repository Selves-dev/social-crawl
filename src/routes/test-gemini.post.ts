
import { sendToPostOffice } from '../utils/shared/postOffice/postman';
import { defineEventHandler, readBody } from 'h3';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  // Always use workflow from request, but hardcode the prompt
  const { workflow } = body;
  const postmanMessage = {
    util: 'analyse-media',
    type: 'venue_basics',
    payload: {
      workflow,
      venue: {
        name: 'moxy hotel customs house london',
      }
    }
  };
  // Send to postman (service bus)
  const result = await sendToPostOffice(postmanMessage);
  return result;
});
