// Entrypoint for running a crawl search and mapping results
import axios from 'axios';
import { parseGoogleHtml } from './googleParser';
import { parseTikTokHtml } from './tiktokParser';
import { parseYouTubeHtml } from './youtubeParser';
import { parseInstagramHtml } from './instagramParser';

import type { CrawlSearchResult } from './types';


// Helper to construct a Google search URL with realistic parameters
function buildGoogleSearchUrl(query: string, platform: string): string {
  // Only use essential parameters, randomize num for result count
  const num = Math.floor(Math.random() * 30) + 20; // 20-50 results
  const params = new URLSearchParams({
    q: `${query} ${platform}`,
    num: num.toString(),
    udm: '7', // ensure video results
  });
  return `https://www.google.com/search?${params.toString()}`;
}

export async function crawlSearch(input: string, platform?: string): Promise<any> {

  // If platform is provided, treat as enrichment stage
  if (platform) {
    // Fetch HTML for the link
    const response = await fetchWithRapidApi(input);
    const html = typeof response === 'string' ? response : response.body;
    console.log(`[crawlSearch] Fetched HTML for platform: ${platform}, url: ${input}, length: ${html?.length}`);
    let result;
    // Nitro does not support fs/file output. Logging only.
    if (platform === 'tiktok') {
      console.log(`[crawlSearch] About to call parseTiktokHtml. Input length: ${html?.length}, first 200 chars: ${typeof html === 'string' ? html.slice(0, 200) : ''}`);
      [result] = parseTikTokHtml(html);
      if (!result) {
        console.warn(`[crawlSearch] TikTok parser returned no result for url: ${input}`);
      }
      return result;
    } else if (platform === 'youtube') {
      [result] = parseYouTubeHtml(html);
      if (!result) {
        console.warn(`[crawlSearch] YouTube parser returned no result for url: ${input}`);
      }
      return result;
    } else if (platform === 'instagram') {
      [result] = parseInstagramHtml(html);
      if (!result) {
        console.warn(`[crawlSearch] Instagram parser returned no result for url: ${input}`);
      }
      return result;
    } else {
      console.warn(`[crawlSearch] Unknown platform or no parser for platform: ${platform}, url: ${input}`);
      return { link: input };
    }
  }

  // Otherwise, treat as search stage
  // Search Google for each platform, with random delay between requests

  const platforms = ['tiktok', 'youtube', 'instagram'];
  const results: Record<string, string[]> = {};

  function randomDelay(min = 500, max = 1500) {
    return new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1)) + min));
  }

  for (const platform of platforms) {

    const googleUrl = buildGoogleSearchUrl(input, platform);
    console.log(`[crawlSearch] Building Google search URL for platform: ${platform}`);
    console.log(`[crawlSearch] Google URL: ${googleUrl}`);

    try {
      await randomDelay();
      console.log(`[crawlSearch] Fetching Google search results for platform: ${platform}`);
      const googleData = await fetchWithRapidApi(googleUrl);

      console.log(`[crawlSearch] Parsing Google HTML for platform: ${platform}`);

      let htmlToParse = '';
      if (googleData && googleData.body) {
        htmlToParse = googleData.body;
        console.log(`[crawlSearch] Using 'body' field from response for platform: ${platform}`);

      } else {
        console.warn(`[crawlSearch] No body or html found in ScrapeNinja response for platform: ${platform}, url: ${googleUrl}`);
        results[platform] = [];
        continue;
      }

      console.log(`[crawlSearch] (Google) Raw HTML length:`, htmlToParse.length);
      const links = parseGoogleHtml(htmlToParse, googleUrl).map(r => r.link);
      console.log(`[crawlSearch] Parsed ${links.length} links for platform: ${platform}`);

      results[platform] = links;

    } catch (err) {
      console.error(`[crawlSearch] Google fetch/parse error for ${platform}:`, err);
      results[platform] = [];
    }
  }

  return JSON.stringify(results);
}


// Fetch and parse with ScrapeNinja RapidAPI
export async function fetchWithRapidApi(url: string): Promise<any> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    console.error('[fetchWithRapidApi] RAPIDAPI_KEY is not set in environment variables.');
    throw new Error('RAPIDAPI_KEY is not set in environment variables.');
  }
  const endpoint = 'https://scrapeninja.p.rapidapi.com/scrape';
  // console.log(`[fetchWithRapidApi] Fetching URL: ${url}`);
  try {
    const response = await axios.post(endpoint, { url }, {
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'scrapeninja.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
      }
    });
    return response.data;
  } catch (err) {
    console.error(`[fetchWithRapidApi] Error fetching URL: ${url}`, err);
    throw err;
  }
}



