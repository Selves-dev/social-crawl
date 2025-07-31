// Generic job envelope type for all queues
export type JobEnvelope<T = any> = {
  type: string;
  context: T;
  workflow: import('./workflow').WorkflowContext;
};

export type SearchCrawlContext = {
  query: string;
  platform: string;
  location?: string;
  countryCode?: string;
};
// Shared job types for all queues

export type SearchCrawlJob = {
  link?: string;
  platform: string;
  workflow: import('./workflow').WorkflowContext;
  query?: string;
  type?: string; // Added for routing and compatibility
};

export type MediaScrapeJob = {
  link?: string;
  platform: string;
  workflow: any;
  query?: string;
  type?: string; // Added for routing and compatibility
  title?: string;
};

export type PrepMediaJob = {
  id: string;
  link: string;
  username?: string;
  title?: string;
  caption?: string;
  viewCount?: number;
  likeCount?: number;
  thumbnail?: string;
  workflow?: any;
};

export type AIServiceJob = {
  input: any;
  workflow?: any;
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
  mediaId: string;
  source: string;
  permalink: string;
  username: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  adminTitle: string;
  slug: string;
  caption: string;
  mediaDescription: string[];
  audioDescription: string[];
  places: Array<{ name: string; confidence: number }>;
  locations: Array<{ name: string; confidence: number }>;
  context: {
    l: string;
    cc: string;
    w: string;
  };
}
