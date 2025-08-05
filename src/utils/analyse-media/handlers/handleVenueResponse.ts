
import { logger } from '../../shared/logger';
import type { Venue } from '../../shared/types';
import { saveVenue } from '../../shared/dbStore';

/**
 * Handler for processing AI venue search responses.
 * @param message - The workflow message or job object
 */
export async function handleVenueResponse(message: any): Promise<any> {
  // Parse the AI response into Venue type
  let raw = message?.response?.text || message?.response || null;
  logger.info('[handleVenueResponse] Raw AI response:', { raw });

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
      // Parse JSON
      const parsed = JSON.parse(clean);
      // Map to Venue structure if needed
      if (parsed.name && parsed.address && parsed.postcode && parsed.roomTypes) {
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
        venue = parsed as Venue;
      }
    }
  } catch (err) {
    logger.error('[handleVenueResponse] Failed to parse AI response as Venue', err instanceof Error ? err : undefined, { rawError: err });
    return { error: 'Failed to parse AI response as Venue', raw };
  }

  if (!venue || !venue.name || !venue.location || !venue.rooms) {
    logger.error('[handleVenueResponse] Parsed venue missing required fields', undefined, { venue });
    return { error: 'Parsed venue missing required fields', venue };
  }

  // Save to MongoDB
  try {
    await saveVenue(venue);
    logger.info('[handleVenueResponse] Venue saved to DB', { address: venue.location.address, postcode: venue.location.postcode });
    return {
      status: 'venue-response-processed',
      venue
    };
  } catch (err) {
    logger.error('[handleVenueResponse] Failed to save venue to DB', err instanceof Error ? err : undefined, { rawError: err });
    return { error: 'Failed to save venue to DB', venue };
  }
}
