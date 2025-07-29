// Entrypoint for running a crawl search and mapping results
import fetch from 'node-fetch';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { parseHtml as parseGoogleHtml } from './googleParser';
import { parseHtml as parseTiktokHtml } from './tiktokParser';
import { parseHtml as parseYoutubeHtml } from './youtubeParser';
// import { parseHtml as parseInstagramHtml } from './instagramParser';

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

// Entrypoint for running a crawl search and mapping results
// Main crawlSearch function: search or enrich
export async function crawlSearch(input: string, platform?: string): Promise<any> {
  // If platform is provided, treat as enrichment stage
  if (platform) {
    // Fetch HTML for the link
    const html = await fetchWithRapidApi(input);
    if (platform === 'tiktok') {
      const [result] = parseTiktokHtml(html);
      return result;
    } else if (platform === 'youtube') {
      const [result] = parseYoutubeHtml(html);
      return result;
    } else if (platform === 'instagram') {
      // Uncomment to use static import:
      // const [result] = parseInstagramHtml(html);
      // return result;
      return { link: input }; // fallback
    } else {
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
      console.log(`[crawlSearch] Fetched Google data for platform: ${platform}, length: ${googleData?.length || 'unknown'}`);
      console.log(`[crawlSearch] Parsing Google HTML for platform: ${platform}`);
      let htmlToParse = '';
      if (googleData && googleData.body) {
        htmlToParse = googleData.body;
        console.log(`[crawlSearch] Using 'body' field from ScrapeNinja response for platform: ${platform}`);
      } else if (googleData && googleData.html) {
        htmlToParse = googleData.html;
        console.warn(`[crawlSearch] 'body' field missing, using 'html' field from ScrapeNinja response for platform: ${platform}, url: ${googleUrl}`);
      } else {
        console.warn(`[crawlSearch] No body or html found in ScrapeNinja response for platform: ${platform}, url: ${googleUrl}`);
        results[platform] = [];
        continue;
      }

      // Save raw HTML for inspection
      try {
        const safeQuery = input.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
        const outDir = 'output';
        const outFile = `${outDir}/${platform}-search-${safeQuery}.html`;
        // Use static imports for fs helpers (already at top)
        if (!existsSync(outDir)) {
          mkdirSync(outDir);
        }
        writeFileSync(outFile, htmlToParse);
        console.log(`[crawlSearch] Saved raw HTML to ${outFile}`);
      } catch (err) {
        console.warn(`[crawlSearch] Failed to save raw HTML for platform ${platform}: ${err}`);
      }

      const links = parseGoogleHtml(htmlToParse, googleUrl).map(r => r.link);
      console.log(`[crawlSearch] Parsed ${links.length} links for platform: ${platform}`);
      results[platform] = links;
    } catch (err) {
      console.error(`[crawlSearch] Google fetch/parse error for ${platform}:`, err);
      results[platform] = [];
    }
  }

  return results;
}


// Fetch and parse with ScrapeNinja RapidAPI
export async function fetchWithRapidApi(url: string): Promise<any> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    console.error('[fetchWithRapidApi] RAPIDAPI_KEY is not set in environment variables.');
    throw new Error('RAPIDAPI_KEY is not set in environment variables.');
  }
  const endpoint = 'https://scrapeninja.p.rapidapi.com/scrape';
  console.log(`[fetchWithRapidApi] Fetching URL: ${url}`);
  try {
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
    console.log(`[fetchWithRapidApi] Response for URL: ${url}, status: ${response.status}, length: ${typeof data === 'string' ? data.length : (data?.length || 'unknown')}`);
    return data;
  } catch (err) {
    console.error(`[fetchWithRapidApi] Error fetching URL: ${url}`, err);
    throw err;
  }
}



