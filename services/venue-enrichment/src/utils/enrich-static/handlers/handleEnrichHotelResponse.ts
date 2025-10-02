import { logger } from '../../shared/logger';
import { db } from '../../shared/database';
import { HotelDocument } from '../../../types/hotel';

export async function handleEnrichHotelResponse(message: any) {
  logger.debug('[enrich-static] Received AI hotel response', { message });
  
  // DEBUG: Log the exact structure we're receiving
  console.log('=== HANDLER DEBUG: Raw message structure ===');
  console.log('message keys:', Object.keys(message || {}));
  console.log('message.payload keys:', message?.payload ? Object.keys(message.payload) : 'NO PAYLOAD');
  console.log('message.payload.aiPayload:', message?.payload?.aiPayload ? 'EXISTS' : 'MISSING');
  if (message?.payload?.aiPayload) {
    console.log('aiPayload keys:', Object.keys(message.payload.aiPayload));
    console.log('AI_GENERATED_DATA exists:', !!message.payload.aiPayload.AI_GENERATED_DATA);
    if (message.payload.aiPayload.AI_GENERATED_DATA) {
      console.log('AI_GENERATED_DATA.mediaIds:', message.payload.aiPayload.AI_GENERATED_DATA.mediaIds);
    }
  }
  console.log('=== END HANDLER DEBUG ===');
  
  // Extract hotel payload from nested message structure
  let payload = message;
  
  // Check if result is in message.payload.result (direct string)
  if (message?.payload?.result && typeof message.payload.result === 'string') {
    try {
      const text = message.payload.result.replace(/```json|```/g, '').trim();
      payload = JSON.parse(text);
      logger.info('[enrich-static] Parsed hotel data from payload.result string', { 
        _id: payload._id, 
        name: payload.name 
      });
    } catch (err) {
      logger.error('[enrich-static] Failed to parse AI hotel response string', err as Error, { 
        text: message.payload.result.substring(0, 500) 
      });
      return { status: 'error', error: 'Failed to parse AI hotel response string', raw: message.payload.result };
    }
  }
  // Check if result is in message.payload.result.text (object with text property)
  else if (message?.payload?.result?.text) {
    try {
      const text = message.payload.result.text.replace(/```json|```/g, '').trim();
      payload = JSON.parse(text);
      logger.info('[enrich-static] Parsed hotel data from payload.result.text', { 
        _id: payload._id, 
        name: payload.name 
      });
    } catch (err) {
      logger.error('[enrich-static] Failed to parse AI hotel response text', err as Error, { 
        text: message.payload.result.text.substring(0, 500) 
      });
      return { status: 'error', error: 'Failed to parse AI hotel response text', raw: message.payload.result.text };
    }
  }
  // Otherwise use the payload as-is (already parsed)
  else if (message?.payload && message.payload._id) {
    payload = message.payload;
    logger.info('[enrich-static] Using payload directly', { 
      _id: payload._id, 
      name: payload.name 
    });
  }

  // Validate required fields
  if (!payload._id || !payload.name) {
    logger.error('[enrich-static] Missing required fields in hotel payload', new Error('Missing required fields'), { 
      hasId: !!payload._id, 
      hasName: !!payload.name,
      payload 
    });
    return { status: 'error', error: 'Missing required fields: _id and name are mandatory', payload };
  }

  // Map payload to HotelDocument structure with explicit field mapping
  const hotel: HotelDocument = {
    _id: payload._id,
    createdAt: payload.createdAt || new Date().toISOString(),
    name: payload.name,
    slug: payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    selves_id: payload.selves_id, // Our unique contextual ID
    rooms: payload.rooms || [],
    __v: payload.__v,
    locationSlug: payload.locationSlug,
    contact: payload.contact,
    identity: payload.identity,
    location: payload.location,
    externalIds: payload.externalIds, // External provider IDs (hotelston, hbx, roibos, etc.)
    foodAndBeverage: payload.foodAndBeverage,
    marketPosition: payload.marketPosition,
    media: payload.media,
    policies: payload.policies,
    reviews: payload.reviews,
    sources: payload.sources,
    sustainability: payload.sustainability,
    facilities: payload.facilities,
    references: payload.references, // References to other collections
    contentLastUpdated: payload.contentLastUpdated || new Date().toISOString()
  };

  // Extract perspective references from the original AI_GENERATED_DATA
  // The mediaIds are in the original combined data, not in AI's response
  console.log('=== HANDLER DEBUG: Looking for mediaIds ===');
  console.log('message.workflow:', message?.workflow);
  
  // Check if aiPayload is available (passed through from ai-service)
  let mediaIds: string[] | undefined;
  if (message?.payload?.aiPayload?.AI_GENERATED_DATA?.mediaIds) {
    mediaIds = message.payload.aiPayload.AI_GENERATED_DATA.mediaIds;
    console.log('Found mediaIds in aiPayload:', mediaIds);
  } else {
    console.log('No mediaIds found in aiPayload');
    console.log('Available payload keys:', message?.payload ? Object.keys(message.payload) : 'none');
  }
  console.log('=== END HANDLER DEBUG ===');
  
  if (mediaIds && Array.isArray(mediaIds) && mediaIds.length > 0) {
    // Ensure references object exists and add perspectives
    if (!hotel.references) {
      hotel.references = {};
    }
    hotel.references.perspectives = mediaIds;
    logger.info('[enrich-static] Added perspective references from venue', { 
      _id: hotel._id, 
      count: mediaIds.length,
      ids: mediaIds
    });
  } else {
    logger.warn('[enrich-static] No mediaIds found in payload', {
      _id: hotel._id,
      hasPayload: !!message?.payload,
      payloadKeys: message?.payload ? Object.keys(message.payload) : []
    });
  }


  // Log which fields are present/missing for debugging
  const fieldsPresent = {
    contact: !!hotel.contact,
    identity: !!hotel.identity,
    location: !!hotel.location,
    facilities: !!hotel.facilities,
    foodAndBeverage: !!hotel.foodAndBeverage,
    marketPosition: !!hotel.marketPosition,
    media: !!hotel.media,
    policies: !!hotel.policies,
    reviews: !!hotel.reviews,
    sources: !!hotel.sources && hotel.sources.length > 0,
    sustainability: !!hotel.sustainability,
    references: !!hotel.references,
    perspectiveCount: hotel.references?.perspectives?.length || 0
  };

  logger.info('[enrich-static] Hotel fields present', { _id: hotel._id, fieldsPresent });

  // Check for potentially missing important nested data
  const warnings: string[] = [];
  if (!hotel.contact) warnings.push('contact');
  if (!hotel.identity) warnings.push('identity');
  if (!hotel.location) warnings.push('location');
  if (!hotel.facilities) warnings.push('facilities');
  if (!hotel.policies) warnings.push('policies');

  if (warnings.length > 0) {
    logger.warn('[enrich-static] Hotel missing recommended fields', { 
      _id: hotel._id, 
      missingFields: warnings 
    });
  }

  try {
    const hotelsDb = db.getSpecificDatabase(process.env['hotels-db-name'] || 's_payload');
    const collection = hotelsDb.collection<HotelDocument>('hotels');
    
    // Upsert hotel document by _id
    const result = await collection.updateOne(
      { _id: hotel._id },
      { $set: hotel },
      { upsert: true }
    );
    
    logger.info('[enrich-static] Hotel upserted successfully', { 
      _id: hotel._id, 
      upserted: !!result.upsertedId,
      modified: result.modifiedCount,
      fieldsPresent 
    });
    
    return { 
      status: 'success', 
      _id: hotel._id, 
      upserted: result.upsertedId || result.modifiedCount,
      fieldsPresent,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    logger.error('[enrich-static] Failed to upsert hotel', error as Error, { hotel });
    return { status: 'error', error: (error as Error).message, hotel };
  }
}