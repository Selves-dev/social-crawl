// --- Standardized result for all platform parsers ---
export interface CrawlSearchResult {
  id?: string;
  link: string;
  title: string;
  snippet?: string;
  username?: string;
  caption?: string;
  thumbnail?: string;
  likeCount?: number | null;
  viewCount?: number | null;
  [key: string]: any; // For parser-specific fields
}
// --- YouTube parser types ---
export interface YouTubeVideoData {
    video_url: string;
    title: string;
    description: string;
    author: string;
    view_count: string;
    like_count: string;
    publish_date: string;
    thumbnail_url: string;
    duration: string;
}

export interface YouTubePlayerResponse {
    videoDetails?: {
        shortDescription?: string;
        viewCount?: string;
    };
}
// --- TYPE DEFINITIONS ---
export interface TikTokVideoData {
  id: string;
  desc: string;
  createTime: number;
  video: {
    playAddr: string;
    cover: string;
    duration: number;
    width: number;
    height: number;
  };
  author: {
    id: string;
    uniqueId: string;
    nickname: string;
    avatarThumb: string;
    verified: boolean;
  };
  stats: {
    diggCount: number;
    shareCount: number;
    commentCount: number;
    playCount: number;
    collectCount: number;
  };
  music?: {
    id: string;
    title: string;
    authorName: string;
  };
  textExtra?: Array<{
    hashtagName?: string;
    userUniqueId?: string;
  }>;
  stickersOnItem?: Array<{
    stickerText: string[];
  }>;
}
// --- Standardized media object for all platform parsers ---
export interface MediaObject {
  id?: string;
  link: string;
  snippet?: string;
  title: string;
  likeCount?: number | null;
  viewCount?: number | null;
  username?: string;
  caption?: string;
  thumbnail?: string;
}

export interface YouTubeInitialData {
    // Use 'any' for flexibility, or add only the fields you actually use
    [key: string]: any;
}

export type SearchCrawlContext = {
  query: string;
  platform: string;
};