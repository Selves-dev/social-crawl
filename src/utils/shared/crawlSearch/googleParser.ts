import type { CrawlSearchResult } from './types';

// Accepts either raw JSON data or a string and returns a unique list of social URLs.
// Optionally includes the original search URL as the first result.
export function parseHtml(data: any, searchUrl?: string): CrawlSearchResult[] {
  // Accepts only raw HTML string
  if (typeof data !== 'string') {
    console.error('Google parser expects a raw HTML string as input.');
    return [];
  }
  const htmlBody = data;

  // Extract /url?q= links and decode them
  // Extract /url?q= links and direct social links
  const foundUrls: string[] = [];


  // 1. /url?q= links
  const urlTagPattern = /<a [^>]*href="\/url\?q=([^&"]+)/g;
  let match;
  while ((match = urlTagPattern.exec(htmlBody)) !== null) {
    try {
      const decoded = decodeURIComponent(match[1]);
      foundUrls.push(decoded);
    } catch {}
  }

  // 2. Direct social links (e.g. <a href="https://instagram.com/...">)
  const directLinkPattern = /<a [^>]*href="(https?:\/\/(?:www\.)?(instagram\.com|tiktok\.com|youtube\.com)[^\s"']+)/gi;
  while ((match = directLinkPattern.exec(htmlBody)) !== null) {
    try {
      foundUrls.push(match[1]);
    } catch {}
  }

  // 3. Also match direct social links in the top section
  const topDirectLinkPattern = /<a [^>]*href="(https?:\/\/(?:www\.)?(instagram\.com|tiktok\.com|youtube\.com)[^\s"']+)/gi;
  while ((match = topDirectLinkPattern.exec(htmlBody)) !== null) {
    try {
      foundUrls.push(match[1]);
    } catch {}
  }
  // Filter for social domains
  const targetDomains = [
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'facebook.com',
    'twitter.com',
  ];
  // Filter for social domains, but exclude facebook.com (google.com is always excluded)
  const filteredUrls = foundUrls.filter(url => {
    // Only include if matches a target domain and does NOT include facebook.com
    return targetDomains.some(domain => url.includes(domain)) &&
      !url.includes('facebook.com');
  });
  // Remove any google.com domains from results (defensive)
const noGoogleUrls = filteredUrls.filter(url => !url.toLowerCase().includes('google.com'));
  const uniqueUrls = [...new Set(noGoogleUrls)].sort();

  // Optionally include the original search URL as the first result
  const resultUrls = uniqueUrls;

  console.log('parseHtml found URLs:', resultUrls);
  return uniqueUrls.map(url => ({
    link: url,
    username: '',
    title: '',
    caption: '',
    viewCount: undefined,
    likeCount: undefined,
    thumbnail: '',
  }));
}

// (No need to re-export parseHtml, already exported above)