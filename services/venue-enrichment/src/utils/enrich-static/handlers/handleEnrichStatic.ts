// Dummy handler for enrich-static, modeled after find-info

import type { PostOfficeMessage, Venue as VenueBase } from '../../shared/types';
// Patch Venue type to include 'type' property for compatibility
type Venue = VenueBase & { type?: string; room_types?: any[] };
import { ObjectId } from 'mongodb';
import { logger } from '../../shared/logger';
import { db } from '../../shared/database';
import { token_set_ratio as fuzzRatio } from 'fuzzball';
import { buildEnrichHotelPrompt, buildResearchRoomPrompt } from './buildEnrichPrompt';
import { sendToPostOffice } from '../../shared/postOffice/postman';

// Haversine formula for distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => x * Math.PI / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export interface EnrichStaticMatch {
  hotelName: string;
  coordinates?: { type: string; coordinates: [number, number] };
  contact?: any;
  englishDescription?: string | null;
  hotelCode?: string;
  primaryMedia?: { code?: string; url?: string; [key: string]: any } | null;
}

export interface EnrichStaticResult {
  success: boolean;
  venue_id?: string;
  name?: string;
  postcode?: string;
  coordinates?: { lat?: number; lon?: number };
  type?: string;
  hotelCode?: string;
  hotelMatchScore?: number;
  matches?: EnrichStaticMatch[];
}

export async function handleEnrichStatic(message: PostOfficeMessage): Promise<EnrichStaticResult> {
  const { payload, workflow } = message;
  let venue_id = payload?._id || payload?.venue_id;
  // Convert to ObjectId if it's a 24-char hex string
  if (venue_id && typeof venue_id === 'string' && venue_id.length === 24 && /^[a-fA-F0-9]+$/.test(venue_id)) {
    try {
      venue_id = new ObjectId(venue_id);
    } catch (e) {
      logger.warn('[enrich-static] Invalid ObjectId format', { venue_id });
    }
  }
  logger.info('[enrich-static] handleEnrichStatic called', { venue_id, workflow });

  if (!venue_id) {
    logger.warn('[enrich-static] No venue_id provided in payload');
    return { success: false };
  }

  try {
    const venuesCollection = db.getCollection<Venue>('venues');
    const venue = await venuesCollection.findOne({ _id: venue_id });
    if (!venue) {
      logger.warn('[enrich-static] Venue not found', { venue_id });
      return { success: false, venue_id };
    }
    const name = venue.name;
    const postcode = venue.location?.postcode;
    const type = venue.type;
    const coordinates = {
      lat: venue.location?.lat,
      lon: venue.location?.lon
    };
    
    // DEBUG: Check if venue has mediaIds
    console.log('=== VENUE DEBUG ===');
    console.log('Venue _id:', venue_id);
    console.log('Venue has mediaIds:', !!venue.mediaIds);
    console.log('mediaIds value:', venue.mediaIds);
    console.log('mediaIds is array:', Array.isArray(venue.mediaIds));
    console.log('mediaIds length:', venue.mediaIds?.length);
    console.log('=== END VENUE DEBUG ===');
    
    logger.info('[enrich-static] Venue details extracted', { name, postcode, coordinates, type });

    // If it's a hotel, do geonear search in hotelston.all-hotels and fuzzy match
    if (type === 'Hotel' && coordinates.lat && coordinates.lon) {
      try {
        const hotelstonDb = db.getSpecificDatabase('hotelston');
        const hotelsCollection = hotelstonDb.collection('all-hotels');
        // Find 10 nearest hotels within 500m
        const candidates = await hotelsCollection.find({
          coordinates: {
            $near: {
              $geometry: { type: 'Point', coordinates: [coordinates.lon, coordinates.lat] },
              $maxDistance: 500
            }
          }
        }).limit(10).toArray();

        logger.debug('[enrich-static] Hotel candidates from geonear', { candidates: candidates.map(h => ({ name: h.name || h.hotelName, coordinates: h.coordinates, _id: h._id })) });

        // Fuzzy match on hotelName, log distance for each
        let bestScore = 0;
        let bestHotel = null;
        const threshold = 90;
        const strongMatches = [];
        for (const hotel of candidates) {
          const hotelName = hotel.hotelName || hotel.name;
          const score = fuzzRatio(name, hotelName);
          let dist = null;
          if (hotel.coordinates && Array.isArray(hotel.coordinates.coordinates)) {
            dist = haversineDistance(
              coordinates.lat,
              coordinates.lon,
              hotel.coordinates.coordinates[1],
              hotel.coordinates.coordinates[0]
            );
          }
          if (score > bestScore) {
            bestScore = score;
            bestHotel = hotel;
          }
          if (score >= threshold) {
            // Extract English description
            let englishDescription = null;
            if (Array.isArray(hotel.descriptions)) {
              for (const desc of hotel.descriptions) {
                if (Array.isArray(desc.texts)) {
                  const enText = desc.texts.find((t: any) => t.language === 'en');
                  if (enText) englishDescription = enText.text;
                }
              }
            }
            strongMatches.push({
              hotelName,
              coordinates: hotel.coordinates,
              contact: hotel.contact,
              englishDescription,
              hotelCode: hotel.hotelCode,
              primaryMedia: Array.isArray(hotel.medias) && hotel.medias.length > 0 ? hotel.medias[0] : null // Only include first media for primary image
            });
          }
        }
        logger.debug('[enrich-static] Strong fuzzy matches (score >= 90)', { matches: strongMatches });
        logger.debug('[enrich-static] Hotel candidates fuzzy matched', { bestScore, bestHotelName: bestHotel?.hotelName });

        // --- ENRICHMENT WORKFLOW ---
        if (strongMatches.length > 0) {
          console.log('=== ENRICHMENT WORKFLOW DEBUG ===');
          console.log('Original venue:', JSON.stringify({ _id: venue_id, name: venue.name }, null, 2));
          console.log('Strong matches found:', JSON.stringify(strongMatches.map(m => ({ hotelName: m.hotelName, hotelCode: m.hotelCode })), null, 2));
          
          // Remove room_types from AI_GENERATED_DATA before sending to AI
          const { room_types, ...venueWithoutRoomTypes } = venue as Venue;
          const combinedHotel = {
            AI_GENERATED_DATA: venueWithoutRoomTypes,
            STATIC_API_DATA: strongMatches.length === 1 ? strongMatches[0] : strongMatches
          };
          
          console.log('Combined hotel data being sent to AI:', JSON.stringify(combinedHotel, null, 2));
          console.log('=== END ENRICHMENT WORKFLOW DEBUG ===');
          
          // Build hotel prompt
          const hotelPromptResult = buildEnrichHotelPrompt(combinedHotel);
          const hotelPrompt = hotelPromptResult?.prompt;
          const hotelPayload = hotelPromptResult?.payload;
          
          logger.debug('[enrich-static] AI hotel prompt generated', { hotelPrompt });
          // Send hotel job to AI
          try {
            await sendToPostOffice({
              util: 'ai-service',
              type: 'search',
              workflow,
              payload: {
                prompt: hotelPrompt,
                aiPayload: hotelPayload,
                responseHandler: {
                  util: 'enrich-static',
                  type: 'enrich-static-ai-hotel-response'
                }
              },
              apiSecret: process.env['taash-secret']
            });
            // Now send room_types for enrichment if present
            if (Array.isArray(room_types) && room_types.length > 0) {
              console.log('=== ROOM ENRICHMENT DEBUG ===');
              console.log('Room types found:', JSON.stringify(room_types, null, 2));
              console.log('venue_id being passed to room enrichment:', venue_id);
              
              const combinedRoom = {
                AI_GENERATED_DATA: room_types,
                STATIC_API_DATA: strongMatches.length === 1 ? strongMatches[0] : strongMatches,
                venueID: venue_id,
                VENUE_CONTEXT: {
                  venue_id: venue_id,
                  venue_name: name,
                  hotel_name: strongMatches[0]?.hotelName || name,
                  postcode: postcode,
                  coordinates: coordinates,
                  type: type,
                  location: {
                    city: venue.location?.city,
                    country: venue.location?.country,
                    street: venue.location?.street
                  }
                }
              };
              
              console.log('Combined room data being sent to AI:', JSON.stringify(combinedRoom, null, 2));
              console.log('=== END ROOM ENRICHMENT DEBUG ===');
              
              const roomPromptResult = buildResearchRoomPrompt(combinedRoom);
              const roomPrompt = roomPromptResult?.prompt;
              const roomPayload = roomPromptResult?.payload;
              logger.debug('[enrich-static] AI room prompt generated', { roomPrompt });
              await sendToPostOffice({
                util: 'ai-service',
                type: 'search',
                workflow,
                payload: {
                  prompt: roomPrompt,
                  aiPayload: roomPayload,
                  responseHandler: {
                    util: 'enrich-static',
                    type: 'enrich-static-ai-research-room-response'
                  }
                },
                apiSecret: process.env['taash-secret']
              });
            }
            // Optionally, update the venue with hotel_id = hotelCode if only one match
            if (strongMatches.length === 1 && strongMatches[0].hotelCode) {
              await venuesCollection.updateOne(
                { _id: venue_id },
                { $set: { hotel_id: strongMatches[0].hotelCode } }
              );
            }
            return { success: true, venue_id, name, postcode, coordinates, type, matches: strongMatches };
          } catch (err) {
            logger.error('[enrich-static] postOffice send failed', err instanceof Error ? err : new Error(String(err)));
            return { success: false, venue_id };
          }
        }
        // Return details even if no confident match
        return { success: true, venue_id, name, postcode, coordinates, type, hotelMatchScore: bestScore };
      } catch (err) {
        logger.error('[enrich-static] Error in hotel geonear/fuzzy match', err instanceof Error ? err : new Error(String(err)));
        return { success: true, venue_id, name, postcode, coordinates, type };
      }
    }
    return { success: true, venue_id, name, postcode, coordinates, type };
  } catch (err) {
    logger.error('[enrich-static] Error fetching venue', err instanceof Error ? err : new Error(String(err)));
    return { success: false, venue_id };
  }
  return { success: false };
}
