// Entrypoint for running a crawl search and mapping results
import axios from 'axios';
import { logger } from '../../shared/logger';
import { parseGoogleHtml } from './googleParser';
import { parseTikTokHtml } from './tiktokParser';
import { parseYouTubeHtml } from './youtubeParser';
import { parseInstagramHtml } from './instagramParser';
import type { CrawlSearchResult } from './types';
import { buildGoogleSearchUrl } from './googleParser';

export async function crawlSearch(input: string, platform?: string): Promise<any> {

  // If platform is provided, treat as enrichment stage
  if (platform) {
    // Fetch HTML for the link
    const response = await fetchWithRapidApi(input);
    const html = typeof response === 'string' ? response : response.body;
    logger.debug(`[crawlSearch] Fetched HTML for platform: ${platform}, url: ${input}, length: ${html?.length}`);
    let result;


    if (platform === 'tiktok') {
      logger.debug(`[crawlSearch] About to call parseTiktokHtml. Input length: ${html?.length}, first 200 chars: ${typeof html === 'string' ? html.slice(0, 200) : ''}`);
      [result] = parseTikTokHtml(html);
      if (!result) {
        logger.warn(`[crawlSearch] TikTok parser returned no result for url: ${input}`);
      }
      return result;


    } else if (platform === 'youtube') {
      [result] = parseYouTubeHtml(html);
      if (!result) {
        logger.warn(`[crawlSearch] YouTube parser returned no result for url: ${input}`);
      }
      return result;


    } else if (platform === 'instagram') {
      [result] = parseInstagramHtml(html);
      if (!result) {
        logger.warn(`[crawlSearch] Instagram parser returned no result for url: ${input}`);
      }
      return result;


    } else {
      logger.warn(`[crawlSearch] Unknown platform or no parser for platform: ${platform}, url: ${input}`);
      return { link: input };
    }
  }

  // Otherwise, treat as search stage

  const platforms = ['tiktok', 'youtube', 'instagram'];
  const results: Record<string, string[]> = {};

  function randomDelay(min = 500, max = 1500) {
    return new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1)) + min));
  }

  for (const platform of platforms) {

    const googleUrl = buildGoogleSearchUrl(input, platform);
    logger.debug(`[crawlSearch] Building Google search URL for platform: ${platform}`);
    logger.info(`[crawlSearch] Google URL: ${googleUrl}`);

    try {
      await randomDelay();
      logger.debug(`[crawlSearch] Fetching Google search results for platform: ${platform}`);
      const googleData = await fetchWithRapidApi(googleUrl);

      logger.debug(`[crawlSearch] Parsing Google HTML for platform: ${platform}`);

      let htmlToParse = '';
      if (googleData && googleData.body) {
        htmlToParse = googleData.body;
        logger.debug(`[crawlSearch] Using 'body' field from response for platform: ${platform}`);

      } else {
        logger.warn(`[crawlSearch] No body or html found in ScrapeNinja response for platform: ${platform}, url: ${googleUrl}`);
        results[platform] = [];
        continue;
      }

      logger.debug(`[crawlSearch] (Google) Raw HTML length: ${htmlToParse.length}`);
      const links = parseGoogleHtml(htmlToParse, googleUrl).map(r => r.link);

      logger.debug(`[crawlSearch] Parsed ${links.length} links for platform: ${platform}`);

      results[platform] = links;

    } catch (err) {
      logger.error(`[crawlSearch] Google fetch/parse error for ${platform}:`, err instanceof Error ? err : new Error(String(err)));
      results[platform] = [];
    }
  }

  return JSON.stringify(results);
}


export async function fetchWithRapidApi(url: string): Promise<any> {
  const rapidApiKey = process.env["rapidapi-key"];
  if (!rapidApiKey) {
    logger.error('[fetchWithRapidApi] rapid-api-key is not set in environment variables.');
    throw new Error('rapid-api-key is not set in environment variables.');
  }
  const endpoint = 'https://scrapeninja.p.rapidapi.com/scrape';

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
    logger.error(`[fetchWithRapidApi] Error fetching URL: ${url}`, err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}



