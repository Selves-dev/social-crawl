import type { CrawlSearchResult } from './types';
import { logger } from '../../shared/logger';
import { findPerspectiveByPermalink, addQueryToPerspective } from '../dbStore';

// Accepts either raw JSON data or a string and returns a unique list of social URLs.
// Accepts the original query for context (if needed for future logic)
export function parseGoogleHtml(data: any, query: string): CrawlSearchResult[] {
  // Accepts only raw HTML string
  if (typeof data !== 'string') {
    logger.error('Google parser expects a raw HTML string as input.');
    return [];
  }
  let htmlBody = data;

  const foundUrls: string[] = [];

  // 1. /url?q= links
  const urlTagPattern = /<a [^>]*href="\/url\?q=([^&"]+)/g;
  let match;
  while ((match = urlTagPattern.exec(htmlBody)) !== null) {
    try {
      const decoded = decodeURIComponent(match[1]);
      foundUrls.push(decoded);
    } catch (err) {
      logger.error('Google parser: Failed to decode /url?q= link', err as Error);
    }
  }

  // 2. Direct social links (e.g. <a href="https://instagram.com/...">)
  const directLinkPattern = /<a [^>]*href="(https?:\/\/(?:www\.)?(instagram\.com|tiktok\.com|youtube\.com)[^\s"']+)/gi;
  while ((match = directLinkPattern.exec(htmlBody)) !== null) {
    try {
      foundUrls.push(match[1]);
    } catch (err) {
      logger.error('Google parser: Failed to extract direct social link', err as Error);
    }
  }

  // 3. Also match direct social links in the top section
  const topDirectLinkPattern = /<a [^>]*href="(https?:\/\/(?:www\.)?(instagram\.com|tiktok\.com|youtube\.com)[^\s"']+)/gi;
  while ((match = topDirectLinkPattern.exec(htmlBody)) !== null) {
    try {
      foundUrls.push(match[1]);
    } catch (err) {
      logger.error('Google parser: Failed to extract top direct social link', err as Error);
    }
  }
  // Log all found URLs before filtering
  logger.debug('parseGoogleHtml: ALL found URLs:', foundUrls);

  // Filter for social domains
  const targetDomains = [
    'instagram.com',
    'tiktok.com',
    'youtube.com',
  ];
  // Filter for social domains, but exclude facebook.com (google.com is always excluded)
  const filteredUrls = foundUrls.filter(url => {
    // Only include if matches a target domain and does NOT include facebook.com
    return targetDomains.some(domain => url.includes(domain)) &&
      !url.includes('facebook.com');
  });
  // Log discarded URLs
  const discardedUrls = foundUrls.filter(url => !filteredUrls.includes(url));
  if (discardedUrls.length > 0) {
    logger.debug('parseGoogleHtml: Discarded URLs (not social):', discardedUrls);
  }
  // Remove any google.com domains from results (defensive)
  const noGoogleUrls = filteredUrls.filter(url => !url.toLowerCase().includes('google.com'));
  const uniqueUrls = [...new Set(noGoogleUrls)].sort();

  const resultUrls = uniqueUrls;
  logger.debug('parseHtml found URLs:', resultUrls);

  // Perspective DB logic: check if each URL is already in the perspectives collection
  checkPerspectivesExist(resultUrls, query);

  return resultUrls.map(url => {
    // Extract platform from URL
    let platform = 'unknown';
    if (url.includes('instagram.com')) {
      platform = 'instagram';
    } else if (url.includes('tiktok.com')) {
      platform = 'tiktok';
    } else if (url.includes('youtube.com')) {
      platform = 'youtube';
    }

    return {
      link: url,
      username: '',
      title: '',
      caption: '',
      viewCount: undefined,
      likeCount: undefined,
      thumbnail: '',
      source: platform
    };
  });
}

/**
 * Checks if each URL exists in the perspectives collection and updates context.w in the DB.
 * @param urls Array of URLs to check
 * @param query The original search query to add to context.w
 */
export async function checkPerspectivesExist(urls: string[], query: string): Promise<void> {
  for (const url of urls) {
    try {
      const existing = await findPerspectiveByPermalink(url);
      if (existing) {
        await addQueryToPerspective(url, query);
        logger.debug('Perspective context.w updated for URL', { url, query });
      } 
    } catch (err) {
      logger.error(`Error checking/updating perspective for URL: ${url}`, err as Error);
    }
  }
}

// Helper to construct a Google search URL with realistic parameters
export function buildGoogleSearchUrl(query: string, platform: string): string {
  // Only use essential parameters, randomize num for result count
  const num = Math.floor(Math.random() * 16) + 35; // 35-50 results
  const params = new URLSearchParams({
    q: `${query} ${platform}`,
    num: num.toString(),
    udm: '7', // ensure video results
  });
  return `https://www.google.com/search?${params.toString()}`;
}

