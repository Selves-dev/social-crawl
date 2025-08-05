import type { CrawlSearchResult, YouTubeVideoData, YouTubePlayerResponse, YouTubeInitialData } from './types';
import * as cheerio from 'cheerio';
import { logger } from '../../shared/logger';

function extractYouTubeVideoId(video_url: string | undefined, originalUrl?: string): string | undefined {
  let id: string | undefined = undefined;
  let urlToAnalyze = video_url;
  
  // If no canonical URL found, try the original URL
  if (!urlToAnalyze && originalUrl) {
    urlToAnalyze = originalUrl;
  }
  
  if (!urlToAnalyze) {
    return undefined;
  }
  
  try {
    // Clean up the URL first
    let cleanUrl = urlToAnalyze
      .replace(/&amp;/g, '&')  // Decode HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
    
    // Remove any trailing fragments or unwanted characters
    cleanUrl = cleanUrl.split('#')[0];
    
    // YouTube video ID is always 11 characters: letters, numbers, hyphens, underscores
    const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
    
    // Array of regex patterns to try, ordered from most specific to most general
    const patterns = [
      // Standard watch URLs with v parameter
      /[?&]v=([a-zA-Z0-9_-]{11})(?:[&]|$)/,
      // Embed URLs
      /(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&]|$)/,
      // Shorts URLs
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:[?&]|$)/,
      // youtu.be short URLs
      /youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?&]|$)/,
      // Mobile URLs
      /m\.youtube\.com\/watch[?]v=([a-zA-Z0-9_-]{11})(?:[&]|$)/,
      // Thumbnail URLs (sometimes found in metadata)
      /\/vi\/([a-zA-Z0-9_-]{11})\/[^\/]*$/,
      // General fallback for any 11-character ID after common patterns
      /(?:watch[?]v=|embed\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    ];
    
    // Try each pattern
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1] && VIDEO_ID_REGEX.test(match[1])) {
        id = match[1];
        logger.debug('YouTube parser: Extracted video ID using pattern', { 
          pattern: pattern.toString(), 
          id, 
          url: cleanUrl 
        });
        break;
      }
    }
    
    // If still no match, try parsing as URL object for query parameters
    if (!id) {
      try {
        const urlObj = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
        const vParam = urlObj.searchParams.get('v');
        if (vParam && VIDEO_ID_REGEX.test(vParam)) {
          id = vParam;
          logger.debug('YouTube parser: Extracted video ID from URL object', { id, url: cleanUrl });
        }
      } catch (urlError) {
        // URL parsing failed, continue with other methods
        logger.debug('YouTube parser: URL parsing failed', { error: urlError, url: cleanUrl });
      }
    }
    
    // Last resort: look for any 11-character alphanumeric sequence that might be a video ID
    if (!id) {
      const segments = cleanUrl.split(/[/?&=]/);
      for (const segment of segments) {
        if (VIDEO_ID_REGEX.test(segment)) {
          // Validate it's likely a YouTube ID by checking context
          const segmentIndex = segments.indexOf(segment);
          const prevSegment = segmentIndex > 0 ? segments[segmentIndex - 1] : '';
          
          // Only accept if it comes after common YouTube URL parts
          if (prevSegment.includes('v') || 
              prevSegment.includes('embed') || 
              prevSegment.includes('shorts') ||
              cleanUrl.includes('youtu.be') ||
              cleanUrl.includes('youtube.com')) {
            id = segment;
            logger.debug('YouTube parser: Extracted video ID from segments', { id, url: cleanUrl });
            break;
          }
        }
      }
    }
    
    // Final validation
    if (id && !VIDEO_ID_REGEX.test(id)) {
      logger.warn('YouTube parser: Extracted ID failed validation', { id, url: cleanUrl });
      id = undefined;
    }
    
    if (!id) {
      logger.warn('YouTube parser: Could not extract valid video ID from URL', { 
        video_url: urlToAnalyze,
        cleanUrl,
        originalUrl 
      });
    } else {
      logger.info('YouTube parser: Successfully extracted video ID', { id, url: cleanUrl });
    }
    
  } catch (error) {
    logger.error(`YouTube parser: Error during video ID extraction: ${error instanceof Error ? error.message : String(error)} | video_url: ${urlToAnalyze} | originalUrl: ${originalUrl}`);
  }
  
  return id;
}

// Alternative helper function for testing different URL formats
function testYouTubeUrlParsing() {
  const testUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=youtu.be',
    'https://youtu.be/dQw4w9WgXcQ?t=42',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'youtube.com/watch?v=dQw4w9WgXcQ&amp;list=PLxyz',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz&index=1',
    'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
  ];
  
  testUrls.forEach(url => {
    const id = extractYouTubeVideoId(url);
    console.log(`URL: ${url} -> ID: ${id}`);
  });
}


// --- MAIN PARSER FUNCTION ---
export function parseYouTubeHtml(htmlContent: string, originalUrl?: string): CrawlSearchResult[] {
  try {
    const $ = cheerio.load(htmlContent);
    // Extract JSON data from scripts
    const scripts: string[] = [];
    $('script').each((_, el) => {
      const text = $(el).html();
      if (text) scripts.push(text);
    });
    let ytInitialData: YouTubeInitialData | null = null;
    let ytInitialPlayerResponse: YouTubePlayerResponse | null = null;
    for (const script of scripts) {
      if (script.includes('var ytInitialData =')) {
        try {
          const jsonStr = script.split('var ytInitialData =')[1].split('};')[0] + '}';
          ytInitialData = JSON.parse(jsonStr);
        } catch (err) {
          logger.error('YouTube parser: Failed to parse ytInitialData', err as Error);
        }
      }
      if (script.includes('var ytInitialPlayerResponse =')) {
        try {
          const jsonStr = script.split('var ytInitialPlayerResponse =')[1].split('};')[0] + '}';
          ytInitialPlayerResponse = JSON.parse(jsonStr);
        } catch (err) {
          logger.error('YouTube parser: Failed to parse ytInitialPlayerResponse', err as Error);
        }
      }
    }

    // Only extract and return the video link
    // Extract fields
    const title = extractTitle($);
    const description = extractDescription($, ytInitialPlayerResponse);
    const author = extractAuthor($);
    const video_url = extractVideoUrl($, originalUrl);
    const thumbnail_url = extractThumbnailUrl($);
    const view_count = extractViewCount(ytInitialPlayerResponse);
    const like_count = extractLikeCount(ytInitialData);

    // Extract video id using the improved extraction function
    const id = extractYouTubeVideoId(video_url, originalUrl);
    // Extract publish date from ytInitialPlayerResponse if available
    let date = '';
    const microformat = (ytInitialPlayerResponse && (ytInitialPlayerResponse as any).microformat) || undefined;
    if (microformat?.playerMicroformatRenderer?.publishDate) {
      // publishDate is usually in 'YYYY-MM-DD' format
      const publishDate = microformat.playerMicroformatRenderer.publishDate;
      // Format as YYYY-MM-DD (no time)
      date = new Date(publishDate).toISOString().slice(0, 10);
    }

    const result = {
      mediaId: id,
      link: video_url || (originalUrl ? originalUrl.replace(/&amp;/g, '&') : ''),
      username: author,
      title,
      caption: description,
      viewCount: view_count ? Number(view_count) : undefined,
      likeCount: like_count ? Number(like_count) : undefined,
      thumbnail: thumbnail_url,
      date,
      source: 'youtube', // Set platform as source
    };
    logger.debug('YouTube parser: Parsed video result', { result });
    // Print each field for clarity
    logger.debug('YouTube parser: Mapped fields', {
      mediaId: result.mediaId,
      link: result.link,
      username: result.username,
      title: result.title,
      caption: result.caption,
      viewCount: result.viewCount,
      likeCount: result.likeCount,
      thumbnail: result.thumbnail,
      date: result.date,
      source: result.source
    });
    return [result];
  } catch (error) {
    logger.error('YouTube parser: Error parsing HTML', error as Error);
    return [];
  }
}
function extractTitle($: any): string {
  const titleTag = $('meta[name="title"]').attr('content') || $('meta[property="og:title"]').attr('content');
  if (titleTag) return titleTag;
  const titleElement = $('title').text();
  if (titleElement) return titleElement.replace(' - YouTube', '').trim();
  return '';
}

function extractDescription($: any, ytInitialPlayerResponse: YouTubePlayerResponse | null): string {
  if (ytInitialPlayerResponse?.videoDetails?.shortDescription) {
    return ytInitialPlayerResponse.videoDetails.shortDescription;
  }
  const descTag = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
  if (descTag) return descTag;
  return '';
}

function extractAuthor($: any): string {
  const authorTag = $('link[itemprop="name"]').attr('content') || $('meta[itemprop="author"]').attr('content');
  if (authorTag) return authorTag;
  const channelTag = $('meta[itemprop="channelId"]').attr('content');
  if (channelTag) return channelTag;
  return '';
}

function extractVideoUrl($: any, originalUrl?: string): string {
  const canonicalUrl = $('link[rel="canonical"]').attr('href');
  if (canonicalUrl && canonicalUrl.trim()) {
    // Decode HTML entities in the URL
    return canonicalUrl.replace(/&amp;/g, '&');
  }
  // Fallback to originalUrl if canonical is missing
  if (originalUrl) {
    return originalUrl.replace(/&amp;/g, '&');
  }
  return '';
}

function extractThumbnailUrl($: any): string {
  return $('meta[property="og:image"]').attr('content') || '';
}

function extractViewCount(ytInitialPlayerResponse: YouTubePlayerResponse | null): string {
  return ytInitialPlayerResponse?.videoDetails?.viewCount || '';
}

function extractLikeCount(ytInitialData: YouTubeInitialData | null): string {
  if (!ytInitialData) return '';
  try {
    const videoPrimaryInfo = ytInitialData.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
      (c: any) => c.videoPrimaryInfoRenderer
    )?.videoPrimaryInfoRenderer;
    const topLevelButtons = videoPrimaryInfo?.videoActions?.menuRenderer?.topLevelButtons;
    if (!topLevelButtons) return '';
    for (const button of topLevelButtons) {
      const label = button.toggleButtonRenderer?.defaultText?.accessibility?.accessibilityData?.label;
      if (label?.includes('like')) {
        const likeMatch = label.match(/([\d,]+) like/);
        if (likeMatch) {
          return likeMatch[1].replace(/,/g, '');
        }
      }
    }
  } catch (err) {
    logger.error('YouTube parser: Failed to extract like count', err as Error);
  }
  return '';
}

// --- MAIN EXPORT ---
export default parseYouTubeHtml;

// Export the improved video ID extraction function for reuse
export { extractYouTubeVideoId, testYouTubeUrlParsing };

// Utility function for debugging/testing
export function printVideoInfo(data: YouTubeVideoData | null): void {
    if (!data) {
        logger.warn('No data found');
        return;
    }

    logger.debug('YouTube URL', { url: data.video_url || 'Not found' });
    logger.debug('Title', { title: data.title });
    logger.debug('Author', { author: data.author });
    logger.debug('Description', { description: data.description || 'No description found' });
    logger.debug('View Count', { viewCount: data.view_count });
    logger.debug('Like Count', { likeCount: data.like_count });
    logger.debug('Thumbnail URL', { thumbnail_url: data.thumbnail_url });
}