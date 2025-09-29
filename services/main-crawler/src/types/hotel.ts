/**
 * TypeScript interfaces for the Hotel schema from groundry.hotels collection
 * Generated from MongoDB sample document on 2025-09-27
 */

export interface HotelDocument {
  _id: string;
  createdAt: string;
  name: string;
  slug: string;
  rooms: HotelRoom[];
  __v?: number;
  locationSlug?: string;
  contact?: HotelContact;
  identity?: HotelIdentity;
  location?: HotelLocation;
  registryId?: string;
  amenitiesAndServices?: HotelAmenitiesAndServices;
  foodAndBeverage?: HotelFoodAndBeverage;
  marketPosition?: HotelMarketPosition;
  media?: HotelMedia;
  policies?: HotelPolicies;
  reviews?: HotelReviews;
  sources?: HotelSource[];
  sustainability?: HotelSustainability;
  facilities?: HotelFacilities;
  contentLastUpdated?: string;
}

export interface HotelRoom {
  roomName: string;
  roomId: string;
  roomSlug: string;
  identity: RoomIdentity;
  hierarchy?: RoomHierarchy;
  pricingContext?: RoomPricingContext;
  wouldMatch?: RoomMatchingCriteria;
  media?: RoomMedia;
  features?: RoomFeatures;
  reviewSnippets?: RoomReviewSnippet[];
  policyOverrides?: RoomPolicyOverrides;
  id: string;
}

export interface RoomIdentity {
  name: string;
  roomType: string;
  sizeSqMeters?: number;
  capacity?: RoomCapacity;
  description?: string;
}

export interface RoomCapacity {
  maxAdults: number;
  maxChildren: number;
  maxInfants: number;
  policy?: string;
}

export interface RoomHierarchy {
  tier: string;
  upgradeFromRoomId?: string;
  upgradeToRoomId?: string;
}

export interface RoomPricingContext {
  avgNightlyRate?: {
    min: number;
    max: number;
    currency: string;
  };
  rateVsStandardRoom?: string;
}

export interface RoomMatchingCriteria {
  tags?: string[];
  idealFor?: string[];
  notIdealFor?: string[];
}

export interface RoomMedia {
  primaryImageUrl?: string;
  virtualTourUrl?: string;
  gallery?: MediaGalleryItem[];
  photoCount?: number;
}

export interface MediaGalleryItem {
  url: string;
  caption?: string;
  alt?: string;
  tags?: string[];
}

export interface RoomFeatures {
  amenities?: RoomAmenities;
  bathroomType?: string;
  uniqueFeatures?: string[];
  accessibility?: string;
}

export interface RoomAmenities {
  climateControl?: string[];
  entertainment?: string[];
  refreshments?: {
    coffeeMachine?: {
      type: string;
      podsIncluded?: number;
    };
    miniFridge?: boolean;
    kettle?: boolean;
  };
  workspace?: string[];
}

export interface RoomReviewSnippet {
  text: string;
  source: string;
  date: string;
  travelerType?: string;
}

export interface RoomPolicyOverrides {
  depositRequirements?: string;
}

export interface HotelContact {
  phone?: string;
  email?: string;
  websiteUrl?: string;
}

export interface HotelIdentity {
  name?: string;
  starRating?: number;
  priceTier?: string;
  hotelType?: string[];
  brandAffiliation?: string;
  descriptionShort?: string;
}

export interface HotelLocation {
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
  neighborhood?: string;
  walkabilityScore?: number;
  pointsOfInterest?: PointOfInterest[];
}

export interface PointOfInterest {
  name: string;
  walk_time_minutes: number;
  category: string;
}

export interface HotelAmenitiesAndServices {
  hotelAmenities?: string[];
  parking?: {
    available: boolean;
    onSite: boolean;
    cost?: string;
  };
  concierge?: string;
  airportShuttle?: {
    available: boolean;
    details?: string;
  };
  spa?: string;
  businessAndEvents?: string[];
}

export interface HotelFoodAndBeverage {
  restaurants?: Restaurant[];
  breakfast?: {
    type: string;
    includedInRate?: boolean;
  };
  dietaryOptions?: string[];
}

export interface Restaurant {
  name: string;
  cuisine?: string;
  awards?: string[];
  hours?: string;
}

export interface HotelMarketPosition {
  similarHotels?: SimilarHotel[];
  uniqueSellingPoints?: string[];
}

export interface SimilarHotel {
  name: string;
  registryId: string;
}

export interface HotelMedia {
  primaryImage?: {
    url: string;
    alt?: string;
  };
  gallery?: MediaGalleryItem[];
  photoCount?: number;
}

export interface HotelPolicies {
  checkInTime?: string;
  checkOutTime?: string;
  cancellationPolicy?: string;
  depositRequirements?: string;
  petPolicy?: {
    petFriendly: boolean;
    petCharge?: string;
    petAmenities?: string[];
  };
}

export interface HotelReviews {
  aggregate?: {
    score: number;
    count: number;
    source: string;
  };
  scoresByCategory?: {
    location?: number;
    cleanliness?: number;
    service?: number;
    value?: number;
  };
}

export interface HotelSource {
  sourceName: string;
  referenceUrl: string;
  type: string;
  date: string;
  description?: string;
}

export interface HotelSustainability {
  certifications?: string[];
  practices?: string[];
}

export interface HotelFacilities {
  hotelAmenities?: string[];
  parking?: {
    available: boolean;
    onSite: boolean;
    cost?: string;
  };
  concierge?: string;
  airportShuttle?: {
    available: boolean;
    details?: string;
  };
  spa?: string;
  businessAndEvents?: string[];
}

// Utility types for common operations
export type HotelPartial = Partial<HotelDocument>;
export type HotelWithoutId = Omit<HotelDocument, '_id'>;
export type HotelCreateInput = Omit<HotelDocument, '_id' | 'createdAt' | '__v'>;

// Type guards
export function isHotelDocument(obj: any): obj is HotelDocument {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj._id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string' &&
    Array.isArray(obj.rooms)
  );
}

export function isHotelRoom(obj: any): obj is HotelRoom {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.roomName === 'string' &&
    typeof obj.roomId === 'string' &&
    typeof obj.roomSlug === 'string' &&
    typeof obj.identity === 'object'
  );
}