import type { CrawlSearchResult } from './types';
import { logger } from '../../shared/logger';

// Helper functions (extractInstagramId, decodeHtmlEntities) are unchanged and work correctly.
function extractInstagramId(url: string): string {
  // This updated regex optionally matches a username path in the URL
  const match = url.match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}

function decodeHtmlEntities(text: string): string {
    if (!text) return '';
    const entities: { [key: string]: string } = { '&quot;': '"', '&amp;': '&' };
    return text.replace(/&quot;|&amp;/g, match => entities[match]);
}


function mapInstagramHtmlToCrawlSearchResult(html: string): CrawlSearchResult | null {
  try {
    // --- Step 1: Find the Link ---
    const urlMatch = html.match(/<link rel="canonical" href="(.+?)"/s);
    const url = urlMatch ? urlMatch[1] : '';

    // --- Step 2: Find the Thumbnail ---
    const thumbnailMatch = html.match(/<meta property="og:image" content="(.+?)"/s);
    const thumbnailUrl = thumbnailMatch ? thumbnailMatch[1].replace(/&amp;/g, '&') : '';

    // --- Step 3: Find the Title ---
    // The `/s` flag is the CRITICAL fix that allows the regex to work across newlines.
    const titleMatch = html.match(/<meta property="og:title" content="(.+?)"/s);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
    
    // --- Step 4: Find the Description ---
    const descriptionMatch = html.match(/<meta property="og:description" content="(.+?)"/s);
    const description = descriptionMatch ? decodeHtmlEntities(descriptionMatch[1]) : '';

    logger.debug('Extracted Description', { description }); // This should now show the full description.

    // --- Step 5: Parse the Description to get the details ---
    let username: string | undefined;
    let caption: string = description; // Default to full description
    let likeCount: number | undefined;
    let publishDate: string | undefined;

    // This pattern works once the description is correctly extracted.
    const pattern = /(\d+)\s+likes,\s*(\d+)\s+comments\s+-\s+([^\s]+)\s+on\s+([^:]+):\s*"([^"]+)"\.?\s*$/s;
    const match = description.match(pattern);

    if (match) {
        likeCount = parseInt(match[1], 10);
        username = match[3];
        publishDate = match[4].trim();
        caption = match[5].trim();
    } else if (title) { // Fallback to get username from title
        const titleUsernameMatch = title.match(/^(.+?)\s+on Instagram/);
        if (titleUsernameMatch) username = titleUsernameMatch[1].replace(/\|/g, '-').trim();
    }
    
    // --- Step 6: Assemble the Final Result ---
    const result: CrawlSearchResult = {
        mediaId: extractInstagramId(url),
        link: url,
        username: username || '',
        title: title,
        caption: caption,
        viewCount: undefined,
        likeCount,
        thumbnail: thumbnailUrl,
        date: publishDate,
    };

    logger.debug('Final Mapped Result', { result });
    return result;

  } catch (error) {
    logger.error('Instagram parser: Error mapping HTML', error as Error);
    return null;
  }
}

export function parseInstagramHtml(htmlContent: string): CrawlSearchResult[] {
  const mapped = mapInstagramHtmlToCrawlSearchResult(htmlContent);
  return mapped ? [mapped] : [];
}