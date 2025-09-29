import { logger } from '../../shared/logger';
import type { VenueData, Hotel, Restaurant, Experience, Venue } from '../../shared/types';
import { saveVenue } from '../../shared/dbStore';
import { getCoordinates, enrichHotelVenue } from './venueUtils';

/**
 * Extracts JSON from AI response text that may contain markdown code blocks
 * Handles responses that have explanatory text followed by ```json ... ``` blocks
 */
function extractJSONFromResponse(raw: string): string {
  if (typeof raw !== 'string') return raw;
  
  // First try to find JSON within markdown code blocks
  const jsonBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    logger.debug('[extractJSONFromResponse] Found JSON code block', { 
      originalLength: raw.length,
      extractedLength: jsonBlockMatch[1].length 
    });
    return jsonBlockMatch[1].trim();
  }
  
  // If no code blocks, try to find JSON object by looking for { ... }
  const jsonObjectMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    logger.debug('[extractJSONFromResponse] Found JSON object in text', { 
      originalLength: raw.length,
      extractedLength: jsonObjectMatch[0].length 
    });
    return jsonObjectMatch[0].trim();
  }
  
  // Fallback: assume the entire response is JSON (legacy behavior)
  logger.debug('[extractJSONFromResponse] Using entire response as JSON');
  return raw.trim();
}


export async function handleVenueResponse(message: any): Promise<any> {
  
  const raw = message?.payload?.result;
  const mediaUrl = message?.payload?.mediaUrl;
  const mediaId = message?.payload?.mediaId;
  
  logger.info('[handleVenueResponse] Starting venue processing', { 
    hasRaw: !!raw, 
    rawType: typeof raw,
    mediaUrl,
    mediaId,
    rawPreview: typeof raw === 'string' ? raw : 'not string'
  });
    
  if (!raw) return { error: 'No AI response found' };
  if (raw?.error) return { error: 'AI service failed' };
  
  try {
    // Extract JSON from response text
    const jsonText = extractJSONFromResponse(raw);
    logger.info('[handleVenueResponse] Extracted JSON text', { 
      originalLength: typeof raw === 'string' ? raw.length : 'not string',
      extractedLength: jsonText.length,
      extractedPreview: jsonText.slice(0, 200)
    });
    
    // Parse the venue from AI response
    const parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    logger.info('[handleVenueResponse] Parsed venue data', { 
      hasName: !!parsed.name,
      venueName: parsed.name,
      venueType: parsed.type,
      hasLocation: !!parsed.location
    });
    
    // Handle no venue found (explicit status or missing venue data)
    if (parsed.status === 'not_found' || !parsed.name) {
      logger.warn('[handleVenueResponse] No venue found in AI response', { 
        status: parsed.status,
        hasName: !!parsed.name,
        rawPreview: JSON.stringify(parsed).substring(0, 200) 
      });
      return { 
        status: 'venue-response-processed-no-venue',
        message: 'No venue information found',
        venue: null 
      };
    }
    
    const venue = parsed;
    const countryCode = message?.workflow?.cc || 'GB'; // Default to GB
    logger.info('[handleVenueResponse] Processing venue', { 
      venueName: venue.name,
      countryCode,
      hasLocation: !!venue.location,
      zipcode: venue.location?.zipcode
    });
    
    // Always get coordinates for venue
    const coordinates = await getCoordinates(venue, countryCode);
    logger.info('[handleVenueResponse] Got coordinates', { 
      success: !!coordinates,
      lat: coordinates?.lat,
      lon: coordinates?.lon
    });
    
    if (coordinates) {
      if (!venue.location) venue.location = {};
      venue.location.lat = coordinates.lat;
      venue.location.lon = coordinates.lon;
    }
    
    // Enrich hotel venues with hotelCode from hotelston database
    if (venue.type === 'Hotel') {
      await enrichHotelVenue(venue, countryCode);
    }

    // Add mediaUrl to venue if available
    if (mediaUrl) {
      venue.mediaUrl = mediaUrl;
    }

    // Save to database with mediaId for bidirectional linking
    logger.info('[handleVenueResponse] Saving venue to database', { 
      venueName: venue.name,
      mediaId,
      mediaUrl,
      hasCoordinates: !!(venue.location?.lat && venue.location?.lon)
    });
    
    const savedId = await saveVenue(venue, mediaId);
    logger.info('[handleVenueResponse] Successfully processed and saved venue', { 
      venueName: venue.name,
      savedId,
      mediaId,
      mediaUrl
    });
    
    return {
      status: 'venue-response-processed',
      venue
    };
    
  } catch (err) {
    logger.error('[handleVenueResponse] Processing failed', err instanceof Error ? err : new Error(String(err)), { raw });
    return { error: 'Failed to process venue response', raw };
  }
}