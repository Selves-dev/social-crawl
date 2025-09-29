import { logger } from '../../shared/logger';
import { db } from '../../shared/database';
import stringSimilarity from 'string-similarity';

const GEOAPIFY_API_KEY = process.env['geoapify-api-key'];

// Hotel lookup interfaces and function
interface HotelLookupResult {
  hotelCode: string;
  hotelName: string;
  confidence: number;
  distance?: number; // meters
}

interface HotelstonHotel {
  _id: string;
  hotelCode: string;
  hotelName: string;
  location?: {
    address?: string;
    zipCode?: string;
    city?: string;
    country?: string;
  };
  contact?: any;
  descriptions?: any[];
  medias?: any[];
  rooms?: any;
  coordinates?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude] - GeoJSON format
  };
}

/**
 * Simple hotel lookup: geoNear -> fuzzy name match -> postcode check
 */
async function findHotelCode(venue: any, countryCode: string): Promise<HotelLookupResult | null> {
  if (!venue || venue.type !== 'Hotel' || !venue.name) {
    return null;
  }

  const venueName = venue.name;
  const venueZipcode = venue.location?.zipcode || venue.location?.postcode;
  const venueLat = venue.location?.lat;
  const venueLon = venue.location?.lon;

  logger.info('[findHotelCode] Simple hotel lookup', { venueName, venueZipcode, hasCoordinates: !!(venueLat && venueLon) });

  try {
    const hotelstonDb = db.getSpecificDatabase('hotelston');
    const collection = hotelstonDb.collection<HotelstonHotel>('all-hotels');
    
    // Step 1: GeoNear search (if coordinates available)
    let candidates: HotelstonHotel[] = [];
    
    if (venueLat && venueLon) {
      logger.info('[findHotelCode] Attempting GeoNear search', {
        venueLat,
        venueLon,
        geoNearQuery: {
          near: { type: "Point", coordinates: [venueLon, venueLat] },
          maxDistance: 1000
        }
      });
      
      try {
        candidates = await collection.aggregate([
          {
            $geoNear: {
              near: { type: "Point", coordinates: [venueLon, venueLat] },
              distanceField: "distance",
              maxDistance: 1000, // 1km radius
              spherical: true,
              key: "coordinates" // GeoJSON coordinates field
            }
          },
          { $limit: 50 }
        ]).toArray() as HotelstonHotel[];
        
        logger.info('[findHotelCode] GeoNear search completed', { 
          candidateCount: candidates.length,
          firstFewCandidates: candidates.slice(0, 3).map(h => ({
            hotelName: h.hotelName,
            hotelCode: h.hotelCode,
            coordinates: h.coordinates,
            distance: (h as any).distance
          }))
        });
      } catch (geoError) {
        logger.error('[findHotelCode] GeoNear search failed, trying fallback approach', geoError instanceof Error ? geoError : new Error(String(geoError)));
        
        // Fallback: Use bounding box search if GeoNear fails
        const searchRadius = 0.009; // ~1km in degrees
        candidates = await collection.find({
          'coordinates.coordinates.1': { // latitude is index 1 in GeoJSON
            $gte: venueLat - searchRadius, 
            $lte: venueLat + searchRadius 
          },
          'coordinates.coordinates.0': { // longitude is index 0 in GeoJSON
            $gte: venueLon - searchRadius, 
            $lte: venueLon + searchRadius 
          }
        }).limit(50).toArray();
        
        logger.info('[findHotelCode] Fallback bounding box search completed', { 
          candidateCount: candidates.length,
          searchRadius,
          firstFewCandidates: candidates.slice(0, 3).map(h => ({
            hotelName: h.hotelName,
            hotelCode: h.hotelCode,
            coordinates: h.coordinates
          }))
        });
      }
      
      logger.debug('[findHotelCode] Final candidate list ready', { count: candidates.length });
    }
    
    // Step 2: Fuzzy name search on candidates
    let bestMatch: HotelstonHotel | null = null;
    let bestScore = 0;
    let bestDistance: number | undefined;
    
    for (const hotel of candidates) {
      if (!hotel.hotelName) continue;
      
      // Simple name normalization
      const normalizedVenue = venueName.toLowerCase().trim();
      const normalizedHotel = hotel.hotelName.toLowerCase().trim();
      
      const similarity = stringSimilarity.compareTwoStrings(normalizedVenue, normalizedHotel);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = hotel;
        bestDistance = (hotel as any).distance; // from geoNear
      }
    }
    
    // Step 3: Postcode check (boost confidence if matches)
    if (bestMatch && venueZipcode && bestMatch.location?.zipCode) {
      const postcodeMatch = bestMatch.location.zipCode.toLowerCase() === venueZipcode.toLowerCase();
      if (postcodeMatch) {
        bestScore = Math.min(0.95, bestScore + 0.2); // Boost score
        logger.debug('[findHotelCode] Postcode match found', { venueZipcode, hotelZipcode: bestMatch.location.zipCode });
      }
    }
    
    // Return result if confidence is high enough
    if (bestScore >= 0.7 && bestMatch) {
      logger.info('[findHotelCode] Hotel match found', {
        hotelCode: bestMatch.hotelCode,
        hotelName: bestMatch.hotelName,
        confidence: bestScore,
        distance: bestDistance ? Math.round(bestDistance) : undefined
      });
      
      return {
        hotelCode: bestMatch.hotelCode,
        hotelName: bestMatch.hotelName,
        confidence: bestScore,
        distance: bestDistance ? Math.round(bestDistance) : undefined
      };
    }
    
    logger.info('[findHotelCode] No suitable match found', { bestScore, candidateCount: candidates.length });
    return null;
    
  } catch (error) {
    logger.error('[findHotelCode] Hotel lookup failed', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}


function createGeocodeParams(venue: any, countryCode: string): URLSearchParams {
  const params = new URLSearchParams();
  params.append('format', 'json');
  params.append('apiKey', GEOAPIFY_API_KEY);

  params.append('postcode', venue.location?.zipcode);
  params.append('country', countryCode);

  // For non-GB countries, add additional address details for better matching
  if (countryCode !== 'GB') {
    const location = venue.location;
    if (venue.name) params.append('name', venue.name);
    if (location?.street) params.append('street', location.street);
    if (location?.address) params.append('street', location.address); // fallback for legacy field
    if (location?.city) params.append('city', location.city);
    if (location?.state_province) params.append('state', location.state_province);
  }

  return params;
}

export async function getCoordinates(venue: any, countryCode: string): Promise<{ lat: number; lon: number } | null> {
  const postcode = venue.location?.zipcode;
  if (!postcode) return null;

  try {
    const params = createGeocodeParams(venue, countryCode);
    const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.results?.[0];
    
    return result?.lat && result?.lon ? { lat: result.lat, lon: result.lon } : null;
  } catch {
    return null;
  }
}


export async function enrichHotelVenue(venue: any, countryCode: string): Promise<any> {
  logger.info('[enrichHotelVenue] Starting hotel enrichment', {
    venueName: venue?.name,
    venueType: venue?.type,
    hasVenue: !!venue,
    countryCode
  });

  if (!venue || venue.type !== 'Hotel') {
    logger.debug('[enrichHotelVenue] Skipping enrichment - not a hotel venue', {
      hasVenue: !!venue,
      venueType: venue?.type,
      venueName: venue?.name
    });
    return venue;
  }

  logger.info('[enrichHotelVenue] Venue is a Hotel, proceeding with lookup', {
    venueName: venue.name,
    venueType: venue.type,
    countryCode
  });

  try {
    logger.info('[enrichHotelVenue] Calling findHotelCode...', {
      venueName: venue.name
    });
    
    const hotelMatch = await findHotelCode(venue, countryCode);
    
    logger.info('[enrichHotelVenue] findHotelCode completed', {
      venueName: venue.name,
      hasMatch: !!hotelMatch,
      confidence: hotelMatch?.confidence
    });
    
    if (hotelMatch && hotelMatch.confidence > 0.75) {
      venue.hotelCode = hotelMatch.hotelCode;
      
      logger.info('[enrichHotelVenue] Successfully linked hotel to hotelston database', {
        venueName: venue.name,
        hotelCode: hotelMatch.hotelCode,
        hotelName: hotelMatch.hotelName,
        confidence: hotelMatch.confidence.toFixed(3),
        distance: hotelMatch.distance
      });
      
    } else {
      logger.info('[enrichHotelVenue] No suitable hotel match found or confidence too low', {
        venueName: venue.name,
        hasMatch: !!hotelMatch,
        confidence: hotelMatch?.confidence?.toFixed(3),
        thresholdRequired: 0.75
      });
    }
  } catch (error) {
    logger.error('[enrichHotelVenue] Hotel enrichment failed', 
      error instanceof Error ? error : new Error(String(error)), 
      { venueName: venue.name }
    );
    // Continue without enrichment - don't fail the entire venue processing
  }

  logger.info('[enrichHotelVenue] Hotel enrichment completed', {
    venueName: venue.name,
    hasHotelCode: !!venue.hotelCode,
    hotelCode: venue.hotelCode
  });

  return venue;
}
