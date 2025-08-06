import { logger } from '../../shared/logger';
import type { Venue } from '../../shared/types';
import { saveVenue } from '../../shared/dbStore';

/**
 * Handler for processing AI venue search responses.
 * @param message - The workflow message or job object
 */
export async function handleVenueResponse(message: any): Promise<any> {
  // Expect the AI response text as a plain string at message.payload.result
  let raw = message?.payload?.result || null;

  logger.debug('[handleVenueResponse] Raw AI response:', { message });
  logger.debug('[handleVenueResponse] Extracted raw text:', { raw });

  if (!raw || (typeof raw === 'string' && !raw.trim())) {
    logger.error('[handleVenueResponse] No AI response text found', undefined, { raw });
    return { error: 'No AI response text found', raw };
  }

  let venue: Venue | null = null;
  try {
    // If already an object, use as is; if string, try to parse as JSON
    if (typeof raw === 'object' && raw !== null) {
      venue = raw as Venue;
    } else if (typeof raw === 'string') {
      // Remove Markdown code block markers if present
      let clean = raw.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
      }
      
      logger.debug('[handleVenueResponse] Cleaned JSON string:', { clean });
      
      // Parse JSON
      const parsed = JSON.parse(clean);
      logger.debug('[handleVenueResponse] Parsed JSON:', { parsed });
      
      // Accept both new and old structures
      if (parsed.name && parsed.location && typeof parsed.location.address === 'string' && typeof parsed.location.postcode === 'string') {
        venue = {
          name: parsed.name,
          location: {
            address: parsed.location.address,
            postcode: parsed.location.postcode
          },
          rooms: Array.isArray(parsed.rooms)
            ? parsed.rooms.map((room: any) => ({ name: room.name || room }))
            : []
        };
      } else if (parsed.name && parsed.address && parsed.postcode && parsed.roomTypes) {
        // Old structure fallback
        venue = {
          name: parsed.name,
          location: {
            address: parsed.address,
            postcode: parsed.postcode
          },
          rooms: Array.isArray(parsed.roomTypes)
            ? parsed.roomTypes.map((name: string) => ({ name }))
            : []
        };
      } else {
        logger.warn('[handleVenueResponse] Parsed object does not match expected Venue structure', { parsed });
        venue = parsed as Venue;
      }
    } else {
      logger.error('[handleVenueResponse] Raw response is neither object nor string', undefined, { raw, type: typeof raw });
      return { error: 'Invalid response format', raw };
    }
    
    // Ensure rooms is always an array
    if (venue && !Array.isArray(venue.rooms)) {
      venue.rooms = [];
    }
    
    // If not a hotel, ensure rooms is an empty array
    if (venue && venue.rooms && venue.rooms.length > 0) {
      // Heuristic: if venue.name or location/address does not indicate hotel, clear rooms
      const nameLower = (venue.name || '').toLowerCase();
      const addressLower = (venue.location?.address || '').toLowerCase();
      if (!nameLower.includes('hotel') && !addressLower.includes('hotel')) {
        venue.rooms = [];
      }
    }
    
    logger.info('[handleVenueResponse] Successfully parsed venue:', { venue });
    
  } catch (err) {
    logger.error('[handleVenueResponse] Failed to parse AI response as Venue', err instanceof Error ? err : undefined, { rawError: err, raw });
    return { error: 'Failed to parse AI response as Venue', raw };
  }

  if (!venue || !venue.name || !venue.location || venue.rooms === undefined) {
    logger.error('[handleVenueResponse] Parsed venue missing required fields', undefined, { venue });
    return { error: 'Parsed venue missing required fields', venue };
  }

  // Save to MongoDB
  try {
    await saveVenue(venue);
    logger.info('[handleVenueResponse] Venue saved to DB successfully', { 
      name: venue.name,
      address: venue.location.address, 
      postcode: venue.location.postcode,
      roomCount: venue.rooms.length 
    });
    return {
      status: 'venue-response-processed',
      venue
    };
  } catch (err) {
    logger.error('[handleVenueResponse] Failed to save venue to DB', err instanceof Error ? err : undefined, { rawError: err, venue });
    return { error: 'Failed to save venue to DB', venue };
  }
}