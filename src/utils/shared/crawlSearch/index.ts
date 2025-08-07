import { logger } from '../../shared/logger';
import { getGoogleSearchTasks } from './googleParser';
import { parseYouTubeHtml, convertToYouTubeWatchUrl } from './youtubeParser.js';
import { parseTikTokHtml } from './tiktokParser';
import { parseInstagramHtml } from './instagramParser';

const PLATFORM_PARSERS = {
  tiktok: parseTikTokHtml,
  youtube: parseYouTubeHtml,
  instagram: parseInstagramHtml
};

function detectPlatformFromUrl(url) {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com')) return 'instagram';
  return null;
}

async function processIndividualLink(url, workflow) {
  const platform = detectPlatformFromUrl(url);
  
  if (!platform) {
    logger.warn(`[crawlSearch] Cannot detect platform for URL: ${url}`);
    return {
      success: false,
      error: 'Cannot detect platform',
      platform: null,
      url
    };
  }

  const parser = PLATFORM_PARSERS[platform];
    if (!parser) {
      logger.warn(`[crawlSearch] No parser for platform: ${platform}`);
      return {
        success: false,
        error: 'No parser for platform',
        platform,
        url
      };
    }

  try {
    // Convert YouTube URLs before fetching
    let fetchUrl = url;
    if (platform === 'youtube') {
      fetchUrl = convertToYouTubeWatchUrl(url);
    logger.debug(`[crawlSearch] Converted YouTube URL: ${fetchUrl}`);
    }

  const html = await fetchWithRapidApi(fetchUrl, platform, workflow);
  if (!html) {
    logger.warn(`[crawlSearch] No HTML for ${platform}, url: ${fetchUrl}`);
    return {
      success: false,
      error: 'No HTML returned',
      platform,
      url: fetchUrl
    };
  }
  logger.debug(`[crawlSearch] Fetched HTML for ${platform}, url: ${fetchUrl}, length: ${html?.length}`);
  // Parse based on platform
  let result;
  [result] = parser(html, fetchUrl);
  if (!result) {
    logger.warn(`[crawlSearch] No results from ${platform} parser for url: ${fetchUrl}`);
    return {
      success: false,
      error: 'No results from parser',
      platform,
      url: fetchUrl
    };
  }
  return result || {
    success: false,
    error: 'Parser returned undefined result',
    platform,
    url: fetchUrl
  };
  } catch (error) {
    logger.error(`[crawlSearch] Error processing ${platform} link ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      platform,
      url
    };
  }
}

async function crawlSearch(input, platform, workflow) {

  try {
    if (platform) {
      // Individual link processing - this is when we're processing a specific link found from Google
      return await processIndividualLink(input, workflow);
    } else {
      // Google search phase - find all links across platforms, then return them for individual processing
      logger.debug('[crawlSearch] Starting Google search phase across all platforms');
      
      // Use getGoogleSearchTasks to build URLs and parse results for each platform
      const tasks = getGoogleSearchTasks(input, ['tiktok', 'youtube', 'instagram'], logger);
      let allLinks: string[] = [];
      for (const { url, platform, parse } of tasks) {
        logger.debug(`[crawlSearch] Fetching Google search for ${platform}: ${url}`);
        const html = await fetchWithRapidApi(url, 'google', workflow);
        if (!html) {
          logger.warn(`[crawlSearch] No HTML from Google for ${platform}, url: ${url}`);
          continue;
        }
        const links = parse(html);
        allLinks.push(...links);
      }
      
      logger.debug(`[crawlSearch] Google search complete. Found ${allLinks.length} links to process individually`);
      
      // Return the list of URLs as JSON string - these will be processed individually later
      return JSON.stringify(allLinks);
    }
  } catch (error) {
    logger.error(`[crawlSearch] Error occurred: ${error instanceof Error ? error.message : String(error)}`);
    return platform
      ? {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          platform,
          url: input
        }
      : [{
          success: false,
          error: error instanceof Error ? error.message : String(error),
          platform: null,
          url: input
        }];
  }
}

// Local rapid API fetcher
async function fetchWithRapidApi(targetUrl, platform, workflow) {
  try {
    const response = await fetch('https://scrapeninja.p.rapidapi.com/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'scrapeninja.p.rapidapi.com',
        'x-rapidapi-key': String(process.env['rapidapi-key'] || ''),
      } as Record<string, string>,
      body: JSON.stringify({ url: targetUrl }),
    });
    const json = await response.json();
    return json.body;
  } catch (err) {
    console.error(`[fetchWithRapidApi] Error fetching ${platform} url: ${targetUrl}`, err);
    return null;
  }
}

export { crawlSearch };