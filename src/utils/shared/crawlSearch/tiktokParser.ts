import type { CrawlSearchResult, TikTokVideoData } from './types';
import { logger } from '../../shared/logger';

// --- MAIN PARSER FUNCTION ---
export function parseTikTokHtml(htmlContent: string): CrawlSearchResult[] {
  logger.info('TikTok parser: Processing HTML content...');

  try {
    // Find the script tag containing the video data
    const scriptMatch = htmlContent.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/s);
    
    if (!scriptMatch) {
      logger.info('TikTok parser: Could not find data script tag');
      return [];
    }

    // Parse the JSON data
    const jsonData = JSON.parse(scriptMatch[1]);

    // Navigate to the video data
    const videoData = jsonData?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    
    if (!videoData) {
      logger.info('TikTok parser: Could not find video data in JSON');
      return [];
    }

    // Map to our standard format
    const result = mapTikTokVideoData(videoData);
    
    if (result) {
      logger.debug('TikTok parser: Successfully parsed HTML, returning 1 result');
      return [result];
    } else {
      logger.debug('TikTok parser: Failed to map video data');
      return [];
    }

  } catch (error) {
    logger.error('TikTok parser: Error parsing HTML content', error as Error);
    return [];
  }
}

// --- MAP TIKTOK VIDEO DATA TO STANDARD FORMAT ---
function mapTikTokVideoData(videoData: TikTokVideoData): CrawlSearchResult | null {
  try {
    logger.debug('TikTok parser: Mapping video data for ID', { id: videoData.id });
    
    // Build TikTok URL
    const author_username = videoData.author?.uniqueId || '';
    const video_id = videoData.id || '';
    const link = author_username && video_id 
      ? `https://www.tiktok.com/@${author_username}/video/${video_id}`
      : '';

    // Extract description from multiple sources
    let caption = videoData.desc || '';
    
    // Check textExtra for hashtags and mentions if no description
    if (!caption && videoData.textExtra && Array.isArray(videoData.textExtra)) {
      const textParts = videoData.textExtra
        .filter(item => item.hashtagName || item.userUniqueId)
        .map(item => item.hashtagName ? `#${item.hashtagName}` : `@${item.userUniqueId}`)
        .join(' ');
      if (textParts) caption = textParts;
    }

    // Check stickers for text content if still no caption
    if (!caption && videoData.stickersOnItem && Array.isArray(videoData.stickersOnItem)) {
      const stickerTexts = videoData.stickersOnItem
        .filter(sticker => sticker.stickerText && Array.isArray(sticker.stickerText))
        .map(sticker => sticker.stickerText.join(' '))
        .join(' ');
      if (stickerTexts) caption = stickerTexts;
    }

    // Extract date (TikTok uses createTime as a Unix timestamp in seconds)
    let date = '';
    if (videoData.createTime) {
      // Format as YYYY-MM-DD (no time)
      const d = new Date(videoData.createTime * 1000);
      date = d.toISOString().slice(0, 10);
    }

    const result: CrawlSearchResult = {
      mediaId: video_id,
      link,
      username: videoData.author?.uniqueId || videoData.author?.nickname || '',
      title: '', // TikTok doesn't typically have separate titles from descriptions
      caption,
      viewCount: videoData.stats?.playCount || undefined,
      likeCount: videoData.stats?.diggCount || undefined,
      thumbnail: videoData.video?.cover || '',
      date,
      source: 'tiktok', // Set platform as source
    };

    logger.debug('TikTok parser: Successfully mapped video', { result });

    return result;

  } catch (error) {
    logger.error('TikTok parser: Error mapping video data', error as Error);
    return null;
  }
}

// --- MAIN EXPORT ---
export default parseTikTokHtml;