// Canonical message type for PostOffice routing
// All job types below are intended to be used as the payload for PostOfficeMessage
export interface PostOfficeMessage {
  util: string;
  type: string;
  workflow: any;
  payload: any;
}

// Venue type for AI venue extraction and MongoDB
export interface Venue {
  name: string;
  location: {
    address: string;
    postcode: string;
    [key: string]: any;
  };
  rooms: Array<{
    name: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export type SearchCrawlJob = {
  id: string;
  timestamp?: string;
  link?: string;
  platform: string;
  query?: string;
  type?: string; // Added for routing and compatibility
};

export type MediaScrapeJob = {
  id: string;
  timestamp?: string;
  link?: string;
  platform: string;
  query?: string;
  type?: string; // Added for routing and compatibility
  title?: string;
};

export type PrepMediaJob = {
  id: string;
  // Original field from throttleQueue.ts
  mediaUrl?: string;
  // Original field from types.ts
  link?: string;
  username?: string;
  title?: string;
  caption?: string;
  viewCount?: number;
  likeCount?: number;
  thumbnail?: string;
  // Removed workflow, now only in envelope
  type?: 'image' | 'video';
  metadata?: Record<string, any>;
  timestamp?: string;
  media?: {
    video?: string;
    audio?: string;
    thumbnail?: string;
    storyboards?: string[];
  };
};

// Job type for get-media service
export type GetMediaJob = {
  mediaId: string;
  source: string;
  requestedBy: string;
  [key: string]: any;
};

export type AIServiceJob = {
  input: any;
};

export type AnalyseMediaJob = {
  id: string;
  timestamp?: string;
  mediaUrl?: string;
  blobUrl?: string;
  type?: string;
};

// Manifest type for blobs (moved from azureBlob)
export type BlobManifest = {
  id: string;
  platform: string;
  type: string;
  createdAt: number;
  updatedAt?: number;
  size?: number;
  url?: string;
  [key: string]: any;
};

export interface Perspective {
  thumbnail?: string;
  mediaId: string;
  source: string;
  permalink: string;
  username: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  title: string; // Renamed from adminTitle
  slug: string; // Unique field identifier for web browsing
  caption: string;
  mediaDescription: string[];
  audioDescription: string[];
  venues: Array<{ name: string; confidence: number }>;
  locations: Array<{ name: string; confidence: number }>;
  context: {
    l: string;
    cc: string;
    w: string[];
  };
}
