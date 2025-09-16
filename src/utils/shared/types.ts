// Canonical message type for PostOffice routing
// All job types below are intended to be used as the payload for PostOfficeMessage
export interface PostOfficeMessage {
  util: string;
  type: string;
  workflow: any;
  payload: any;
}

// Enhanced venue types for AI venue extraction
export interface BaseVenue {
  name: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Hotel extends BaseVenue {
  hotel_id?: string;
  hotelCode?: string; // Link to hotelston database (3.5M hotel records)
  type: string; // hotel, boutique, resort, aparthotel
  star_rating?: number;
  chain_parent?: string | null;
  year_built?: number | null;
  last_renovated?: number | null;
  short_description?: string | null;
  transport_convenience?: string | null; // excellent, good, moderate
  facilities?: Array<{
    name: string;
    category: string; // dining, recreation, business, wellness, transport
    subcategory?: string | null;
  }>;
  room_types?: Array<{
    name: string;
    bed_configuration?: string | null;
    view_type?: string | null;
  }>;
}

export interface Restaurant extends BaseVenue {
  restaurant_id?: string;
  cuisine_type?: string[];
  price_range?: string; // $, $$, $$$, $$$$
  meal_services?: string[]; // breakfast, lunch, dinner, brunch
}

export interface Experience extends BaseVenue {
  experience_id?: string;
  type: string; // paid_experience, free_attraction, landmark
  category: string; // cultural, historical, adventure, food, entertainment
  subcategory?: string | null;
  visit_duration?: string | null; // 30_minutes, 2_hours, half_day, full_day
  activity_level?: string | null; // low, moderate, high
}

export type VenueData = Hotel | Restaurant | Experience;

// Legacy Venue interface - keeping for backward compatibility
export interface Venue {
  name: string;
  category?: string;
  mediaIds?: string[]; // Array of all mediaIds that reference this venue
  mediaUrl?: string; // URL of the media where this venue was discovered
  location: {
    fullAddress?: string;
    street?: string;
    city?: string;
    state_province?: string | null;
    postcode: string;
    country?: string;
    lat?: number; // Added for coordinate storage
    lon?: number; // Added for coordinate storage
    // Keep legacy address field for backward compatibility
    address?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
  // Simplified attributes - removed priceRange and openingHours
  hotelDetails?: {
    keyFeatures?: string[]; // Moved from attributes
    roomTypes?: Array<{
      name: string;
      description?: string;
      amenities?: string[];
    }>;
  };
  // Published content moved to top level
  publishedContent?: Array<{
    sourceName: string;
    articleTitle?: string;
    author?: string | null;
    url: string;
    contentType?: string;
    publicationDate?: string;
  }>;
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
  venues: Array<{ 
    name: string; 
    confidence: number;
    venueId?: string; // Database ID for saved venues
  }>;
  locations: Array<{ name: string; confidence: number }>;
  context: {
    l: string;
    cc: string;
    w: string[];
  };
}
