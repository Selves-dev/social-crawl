import { logger } from '../../shared/logger';
import { findPerspectiveByPermalink, addQueryToPerspective } from '../dbStore';

export function parseGoogleHtml(data: any, query: string): string[] {
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

  // 2. Direct social links
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
  logger.debug('parseGoogleHtml: ALL found URLs:', foundUrls);

  const targetDomains = [
    'instagram.com',
    'tiktok.com',
    'youtube.com',
  ];
  const filteredUrls = foundUrls.filter(url => {
    return targetDomains.some(domain => url.includes(domain)) &&
      !url.includes('facebook.com');
  });
  const discardedUrls = foundUrls.filter(url => !filteredUrls.includes(url));
  if (discardedUrls.length > 0) {
    logger.debug('parseGoogleHtml: Discarded URLs (not social):', discardedUrls);
  }
  const noGoogleUrls = filteredUrls.filter(url => !url.toLowerCase().includes('google.com'));
  const uniqueUrls = [...new Set(noGoogleUrls)].sort();
  const resultUrls = uniqueUrls;
  logger.debug('parseHtml found URLs:', resultUrls);

  checkPerspectivesExist(resultUrls, query).catch(err => {
    logger.error('Error in background checkPerspectivesExist:', err as Error);
  });

  return resultUrls;
}

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
