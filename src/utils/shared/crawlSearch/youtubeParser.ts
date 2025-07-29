import type { CrawlSearchResult, YouTubeVideoData, YouTubePlayerResponse, YouTubeInitialData } from './types';
import * as cheerio from 'cheerio';


// --- MAIN PARSER FUNCTION ---
export function parseHtml(htmlContent: string): CrawlSearchResult[] {
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
        } catch {}
      }
      if (script.includes('var ytInitialPlayerResponse =')) {
        try {
          const jsonStr = script.split('var ytInitialPlayerResponse =')[1].split('};')[0] + '}';
          ytInitialPlayerResponse = JSON.parse(jsonStr);
        } catch {}
      }
    }

    // Only extract and return the video link
    // Extract fields
    const title = extractTitle($);
    const description = extractDescription($, ytInitialPlayerResponse);
    const author = extractAuthor($);
    const video_url = extractVideoUrl($);
    const thumbnail_url = extractThumbnailUrl($);
    const view_count = extractViewCount(ytInitialPlayerResponse);
    const like_count = extractLikeCount(ytInitialData);

    const result = {
      link: video_url,
      username: author,
      title,
      caption: description,
      viewCount: view_count ? Number(view_count) : undefined,
      likeCount: like_count ? Number(like_count) : undefined,
      thumbnail: thumbnail_url,
    };
    console.log('YouTube parser: Parsed video result:', result);
    return [result];
  } catch (error) {
    console.error('YouTube parser: Error parsing HTML:', (error as Error).message);
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

function extractVideoUrl($: any): string {
  return $('link[rel="canonical"]').attr('href') || '';
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
  } catch {}
  return '';
}

// --- MAIN EXPORT ---
export default parseHtml;

// Utility function for debugging/testing
export function printVideoInfo(data: YouTubeVideoData | null): void {
    if (!data) {
        console.log('No data found');
        return;
    }

    console.log(`YouTube URL: ${data.video_url || 'Not found'}`);
    console.log(`Title: ${data.title}`);
    console.log(`Author: ${data.author}`);
    console.log(`Description: ${data.description || 'No description found'}`);
    console.log(`View Count: ${data.view_count}`);
    console.log(`Like Count: ${data.like_count}`);
    console.log(`Thumbnail URL: ${data.thumbnail_url}`);
}