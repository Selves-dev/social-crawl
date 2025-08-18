import { logger } from '../../shared/logger';
import type { Venue } from '../../shared/types';
import { saveVenue } from '../../shared/dbStore';

/**
 * Handler for processing AI venue search responses.
 * @param message - The workflow message or job object
 */
// Helper: Extract first JSON object from a string
function extractFirstJsonObject(text: string): string | null {
  // Remove any markdown code blocks first
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  
  // Remove any control characters or weird tokens (like <ctrl100>)
  cleaned = cleaned.replace(/<ctrl\d+>/g, '');
  
  // Look for the first JSON object
  const openBrace = cleaned.indexOf('{');
  if (openBrace === -1) return null;
  
  let braceCount = 0;
  let endIndex = -1;
  
  for (let i = openBrace; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      braceCount++;
    } else if (cleaned[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        endIndex = i;
        break;
      }
    }
  }
  
  if (endIndex === -1) return null;
  
  let jsonString = cleaned.substring(openBrace, endIndex + 1);
  
  // Comprehensive sanitization for malformed content
  jsonString = sanitizeJsonString(jsonString);
  
  return jsonString;
}

// Helper: Sanitize JSON string to fix common issues
function sanitizeJsonString(jsonString: string): string {
  // Remove any control characters (characters 0-31 except \t, \n, \r)
  jsonString = jsonString.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  
  // Sanitize extremely long URLs that might break JSON parsing
  // Look for URLs longer than 500 characters and truncate them
  jsonString = jsonString.replace(/"url":\s*"([^"]{500,})"/g, (match, url) => {
    logger.warn('[sanitizeJsonString] Truncating extremely long URL in url field', { 
      originalLength: url.length,
      truncatedLength: 500 
    });
    return `"url": "${url.substring(0, 500)}..."`;
  });
  
  // Look for any string values longer than 2000 characters (likely malformed)
  jsonString = jsonString.replace(/:\s*"([^"]{2000,})"/g, (match, value) => {
    logger.warn('[sanitizeJsonString] Truncating extremely long string value', { 
      originalLength: value.length,
      truncatedLength: 500,
      preview: value.substring(0, 100) + '...'
    });
    return `: "${value.substring(0, 500)}..."`;
  });
  
  // Look for repeated character patterns that might indicate corruption (like 1000+ zeros)
  jsonString = jsonString.replace(/([0-9a-zA-Z])\1{100,}/g, (match, char) => {
    logger.warn('[sanitizeJsonString] Removing repeated character pattern', { 
      character: char,
      repetitions: match.length
    });
    return char.repeat(5) + '...'; // Keep just 5 repetitions
  });
  
  return jsonString;
}

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

      // Extract only the first JSON object/array from the string
      const jsonString = extractFirstJsonObject(clean);
      if (!jsonString) throw new Error('No JSON object found in AI response text');
      
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseErr) {
        logger.error('[handleVenueResponse] JSON parse error', parseErr instanceof Error ? parseErr : undefined, { 
          jsonString: jsonString.substring(0, 1000) + (jsonString.length > 1000 ? '...[truncated]' : ''),
          parseError: parseErr instanceof Error ? parseErr.message : String(parseErr)
        });
        throw new Error(`JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      }
      
      logger.info('[handleVenueResponse] Parsed JSON:', { parsed });

      // Handle the new rich venue structure
      if (parsed.name && parsed.location) {
        venue = {
          name: parsed.name,
          category: parsed.category,
          location: {
            fullAddress: parsed.location.fullAddress,
            street: parsed.location.street,
            city: parsed.location.city,
            state_province: parsed.location.state_province,
            postcode: parsed.location.postcode || '',
            country: parsed.location.country,
            // Backward compatibility: set address to fullAddress if not present
            address: parsed.location.address || parsed.location.fullAddress
          },
          contact: parsed.contact ? {
            phone: parsed.contact.phone,
            email: parsed.contact.email,
            website: parsed.contact.website
          } : undefined,
          hotelDetails: parsed.hotelDetails ? {
            keyFeatures: parsed.hotelDetails.keyFeatures || parsed.attributes?.keyFeatures, // Support both locations
            roomTypes: parsed.hotelDetails.roomTypes
          } : undefined,
          // Published content moved to top level (support both old and new structure)
          publishedContent: parsed.publishedContent || parsed.onlinePresence?.publishedContent
        };
      } else if (parsed.name === null && parsed.location && Object.values(parsed.location).every(val => val === null)) {
        // Handle case where AI correctly returns null values (no venue found)
        logger.info('[handleVenueResponse] AI returned null response - no venue data found', { parsed });
        return {
          status: 'venue-response-processed-no-venue',
          message: 'AI could not find or verify venue information - returned null values',
          venue: null
        };
      } else if (parsed.name && (parsed.address || parsed.location?.address) && (parsed.postcode || parsed.location?.postcode)) {
        // Legacy structure fallback
        venue = {
          name: parsed.name,
          location: {
            address: parsed.address || parsed.location?.address || '',
            postcode: parsed.postcode || parsed.location?.postcode || '',
            fullAddress: parsed.address || parsed.location?.address
          },
          hotelDetails: {
            roomTypes: Array.isArray(parsed.roomTypes)
              ? parsed.roomTypes.map((name: string) => ({ name }))
              : Array.isArray(parsed.rooms) ? parsed.rooms : []
          }
        };
      } else {
        logger.warn('[handleVenueResponse] Parsed object does not match expected Venue structure', { parsed });
        throw new Error('Invalid venue structure: missing required name and location fields');
      }
    } else {
      logger.error('[handleVenueResponse] Raw response is neither object nor string', undefined, { raw, type: typeof raw });
      return { error: 'Invalid response format', raw };
    }
    
    // Validate that required fields are present
    if (venue && venue.hotelDetails?.roomTypes && venue.hotelDetails.roomTypes.length > 0) {
      // Heuristic: if venue.name, category, or location does not indicate hotel, clear room types
      const nameLower = (venue.name || '').toLowerCase();
      const categoryLower = (venue.category || '').toLowerCase();
      const addressLower = (venue.location?.address || venue.location?.fullAddress || '').toLowerCase();
      
      if (!nameLower.includes('hotel') && 
          !categoryLower.includes('hotel') && 
          !addressLower.includes('hotel') &&
          categoryLower !== 'hotel') {
        venue.hotelDetails.roomTypes = [];
      }
    }
    
    logger.info('[handleVenueResponse] Successfully parsed venue:', { venue });
    
    // Check if this is the fallback "No venue found" response and skip saving
    if (venue.name && (venue.name.toLowerCase() === 'no venue found' || venue.name.toLowerCase().includes('no venue'))) {
      logger.info('[handleVenueResponse] Skipping save - no venue found in response', { venueName: venue.name });
      return {
        status: 'venue-response-processed-no-venue',
        message: 'No venue information found, skipped database save',
        venue: null
      };
    }
    
  } catch (err) {
    logger.error('[handleVenueResponse] Failed to parse AI response as Venue', err instanceof Error ? err : undefined, { rawError: err, raw });
    return { error: 'Failed to parse AI response as Venue', raw };
  }

  if (!venue || !venue.name || !venue.location || (!venue.location.postcode && !venue.location.address)) {
    logger.error('[handleVenueResponse] Parsed venue missing required fields', undefined, { venue });
    return { error: 'Parsed venue missing required fields', venue };
  }

  // Save to MongoDB
  try {
    await saveVenue(venue);
    logger.info('[handleVenueResponse] Venue saved to DB successfully', { 
      name: venue.name,
      address: venue.location.address || venue.location.fullAddress, 
      postcode: venue.location.postcode,
      roomCount: venue.hotelDetails?.roomTypes?.length || 0,
      category: venue.category
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