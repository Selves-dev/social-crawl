import type { CrawlSearchResult, YouTubeVideoData, YouTubePlayerResponse, YouTubeInitialData } from './types';
import * as cheerio from 'cheerio';
import { logger } from '../../shared/logger';


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
        const match = script.match(/var ytInitialData = (\{[\s\S]*?\});/);
        if (match) {
          try {
            ytInitialData = JSON.parse(match[1]);
          } catch (err) {
            logger.error('YouTube parser: Failed to parse ytInitialData', err as Error);
          }
        }
      }
      if (script.includes('var ytInitialPlayerResponse =')) {
        const match = script.match(/var ytInitialPlayerResponse = (\{[\s\S]*?\});/);
        if (match) {
          try {
            ytInitialPlayerResponse = JSON.parse(match[1]);
          } catch (err) {
            logger.error('YouTube parser: Failed to parse ytInitialPlayerResponse', err as Error);
          }
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
    logger.info('YouTube parser: Parsed video result', { result });
    // Print each field for clarity
    logger.info('YouTube parser: Mapped fields', {
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
  // Check if canonicalUrl is actually a valid string (not undefined, null, or empty)
  if (canonicalUrl && canonicalUrl !== 'undefined' && canonicalUrl.trim()) {
    return canonicalUrl.replace(/&amp;/g, '&');
  }
  // Fallback to originalUrl if canonical is missing or invalid
  if (originalUrl && originalUrl.trim()) {
    return originalUrl.replace(/&amp;/g, '&');
  }
  
  return '';
}

function extractYouTubeVideoId(video_url: string | undefined): string | undefined {
  // Handle case where video_url might be the string "undefined" or empty
  if (!video_url || video_url === 'undefined' || !video_url.includes('youtube')) {
    return undefined;
  }

  // Clean the URL
  const cleanUrl = video_url.replace(/&amp;/g, '&').trim();
  
  // Simple regex to extract 11-character YouTube video ID
  const match = cleanUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  
  return match ? match[1] : undefined;
}

// Helper function to convert any YouTube URL to proper watch URL format
function convertToYouTubeWatchUrl(url: string): string {
  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return url; // Return original if no video ID found
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
export { extractYouTubeVideoId, convertToYouTubeWatchUrl };

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
    logger.info('Like Count', { likeCount: data.like_count });
    logger.info('Thumbnail URL', { thumbnail_url: data.thumbnail_url });
}
