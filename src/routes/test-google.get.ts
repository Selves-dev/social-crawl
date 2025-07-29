import { parseHtml } from '../utils/shared/crawlSearch/googleParser';
import { defineEventHandler, getQuery } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = typeof query.url === 'string' ? query.url : Array.isArray(query.url) ? query.url[0] : '';
  if (!url) {
    return { error: 'Missing Google URL' };
  }
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      },
    });
    const html = await response.text();
    const results = parseHtml(html);
    return { results, html };
  } catch (err) {
    return { error: 'Failed to fetch or parse Google page', details: String(err) };
  }
});
