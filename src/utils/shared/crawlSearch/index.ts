// Entrypoint for running a crawl search and mapping results
import fetch from 'node-fetch';
import { parseGoogleResults } from './googleParser';
import { parseInstagramResults } from './instagramParser';
import { parseTiktokResults } from './tiktokParser';
import { parseYoutubeResults } from './youtubeParser';
import type { CrawlSearchResult } from './types';


export async function crawlSearch(url: string): Promise<CrawlSearchResult[]> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    throw new Error('RAPIDAPI_KEY is not set in environment variables.');
  }
  const endpoint = 'https://scrapeninja.p.rapidapi.com/scrape';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'scrapeninja.p.rapidapi.com',
      'x-rapidapi-key': rapidApiKey,
    },
    body: JSON.stringify({ url }),
  });
  const data = await response.json();

  // Select parser based on URL
  if (/google\./.test(url)) {
    return parseGoogleResults(data);
  } else if (/instagram\./.test(url)) {
    return parseInstagramResults(data);
  } else if (/tiktok\./.test(url)) {
    return parseTiktokResults(data);
  } else if (/youtube\./.test(url)) {
    return parseYoutubeResults(data);
  } else {
    // Default: return empty array or throw
    return [];
  }
}
