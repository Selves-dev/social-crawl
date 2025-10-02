/**
 * Builds the architect prompt for transforming pre-researched room facts into a structured registry entry.
 * @param {object} architectData - { ALL_ROOM_DATA, CURRENT_ROOM_DATA, PRE_RESEARCHED_FACTS }
 * @returns {object} { prompt, payload }
 */


/**
 * Builds the enrichment prompt for the AI service, including the example output.
 * @param {object} combinedData - An object with two sections: { AI_GENERATED_DATA, STATIC_API_DATA }
 * @returns {object} { prompt, payload }
 */
export function buildEnrichHotelPrompt(combinedData: any): EnrichPromptResult {
  // Hotel prompt logic (as before)
  const hotelExampleOutput = `{
    "_id": "68c2eab059d99f6dfa25cfc7",
    "createdAt": "2025-09-11T15:28:48.200Z",
    "name": "The Maids Head Hotel",
    "slug": "maids-head-norwich-k3r4",
    "selves_id": "maids-head-norwich-k3r4",
    "locationSlug": "england-norfolk-norwich",
    "externalIds": {
      "hotelston": "50456508"
    },
    "contact": {
      "phone": "+44 1603 209955",
      "email": "reservations@maidsheadhotel.co.uk",
      "websiteUrl": "https://www.maidsheadhotel.co.uk/"
    },
    "identity": {
      "starRating": 4,
      "priceTier": "$$$",
      "hotelType": ["Boutique", "Historic"],
      "brandAffiliation": "Historic Hotels of Britain",
      "descriptionShort": "Claiming to be the oldest hotel in the UK, offering a unique blend of historic character and modern comfort in the heart of Norwich."
    },
    "location": {
      "country": "England",
      "region": "Norfolk",
      "city": "Norwich",
      "address": "Tombland, Norwich, NR3 1LB, UK",
      "coordinates": {
        "lat": 52.6323,
        "lon": 1.2989
      },
      "neighborhood": "Cathedral Quarter",
      "walkabilityScore": 98,
      "pointsOfInterest": [
        {
          "name": "Norwich Cathedral",
          "walk_time_minutes": 1,
          "category": "Historic Site"
        },
        {
          "name": "Norwich Castle",
          "walk_time_minutes": 9,
          "category": "Museum"
        }
      ]
    },
    "facilities": {
      "hotelAmenities": ["Free WiFi", "Restaurant", "Bar", "Room Service", "Fitness Suite"],
      "parking": {
        "available": true,
        "onSite": true,
        "cost": "Paid"
      },
      "concierge": "Available 24/7",
      "airportShuttle": {
        "available": true,
        "details": "Airport shuttle available for a fee upon request."
      },
      "spa": "On-site spa with massage services",
      "businessAndEvents": ["Meeting rooms", "Wedding venue"]
    },
    "foodAndBeverage": {
      "restaurants": [
        {
          "name": "The Wine Press Restaurant",
          "cuisine": "British",
          "awards": ["2 AA Rosettes"],
          "hours": "12:00 PM - 10:00 PM"
        }
      ],
      "breakfast": {
        "type": "Buffet and A La Carte",
        "includedInRate": true
      },
      "dietaryOptions": ["Vegetarian", "Gluten-free", "Vegan"]
    },
    "marketPosition": {
      "similarHotels": [
        {
          "name": "The Assembly House",
          "registryId": "reg-hotel-uk-norwich-456"
        }
      ],
      "uniqueSellingPoints": [
        "Continuously operated as the UK's oldest hotel",
        "Prime location directly opposite Norwich Cathedral",
        "Award-winning 2 AA Rosette restaurant on-site"
      ]
    },
    "media": {
      "primaryImage": {
        "url": "https://www.maidsheadhotel.co.uk/wp-content/uploads/2023/11/Maids-Head-Hotel-with-vintage-Bentleys-if-no-credit-required.jpg",
        "alt": "The historic facade of The Maids Head Hotel in Norwich opposite the cathedral."
      }
    },
    "policies": {
      "checkInTime": "15:00",
      "checkOutTime": "11:00",
      "cancellationPolicy": "Free cancellation up to 48 hours before arrival for standard rates.",
      "depositRequirements": "Credit card guarantee required. No deposit for standard rates.",
      "petPolicy": {
        "petFriendly": true,
        "petCharge": "Additional £20 per night",
        "petAmenities": ["Pet bed", "Dog-walking service"]
      }
    },
    "reviews": {
      "aggregate": {
        "score": 4.6,
        "count": 3150,
        "source": "Aggregated across Google, TripAdvisor, Booking.com"
      },
      "scoresByCategory": {
        "location": 4.9,
        "cleanliness": 4.8,
        "service": 4.7,
        "value": 4.5
      }
    },
    "sources": [
      {
        "sourceName": "Lonely Planet",
        "referenceUrl": "https://www.lonelyplanet.com/england/norwich",
        "type": "Travel Guide",
        "date": "2023-03-10",
        "description": "Featured as one of the best boutique hotels in Norwich due to its historical significance and location."
      }
    ],
    "sustainability": {
      "certifications": ["Green Tourism Silver Award"],
      "practices": ["Local sourcing for restaurant", "EV charging stations", "Water conservation program"]
    },
    "contentLastUpdated": "2025-09-27T12:00:00.000Z"
  }`;

  const hotelPrompt = [
    'You are a data processing agent with web search capabilities. Your task is to fuse two JSON data sources for a single hospitality venue into one definitive, clean, and enriched JSON object following the exact schema structure required for the database.',
    '',
    '**IMPORTANT: You have web search enabled. Use it actively to find missing data, verify information, and enrich the output.**',
    '',
    'Core Fusion Rule:',
    'Where a direct conflict exists between a field in Source A and Source B, the data from Source B (Static API Data) takes precedence.',
    '',
    'Input Data:',
    'You will receive two JSON objects: AI_GENERATED_DATA (Source A) and STATIC_API_DATA (Source B).',
    '',
    'Processing Directives:',
    '1. Parse Inputs: Begin by parsing the two provided JSON inputs.',
    '2. Schema Structure: Use the EXACT schema structure shown in the example output below. All fields must be properly nested.',
    '3. Web Search Strategy: For any missing or incomplete data, use web search to find:',
    '   - Official hotel website and contact information',
    '   - Hotel reviews and ratings from TripAdvisor, Google, Booking.com',
    '   - Nearby points of interest and walking distances',
    '   - Restaurant information, awards, and dining options',
    '   - Sustainability certifications and green practices',
    '   - Similar hotels in the area for competitive positioning',
    '   - Pet policies, parking details, and other practical information',
    '',
    '4. Field Mapping Rules:',
    '',
    '   **Core Fields:**',
    '   - _id: Use from AI_GENERATED_DATA or STATIC_API_DATA (MongoDB ObjectId)',
    '   - createdAt: Use existing or generate current ISO timestamp',
    '   - name: Use hotelName from STATIC_API_DATA',
    '   - slug: Generate contextual slug: [hotel-name-slug]-[city-slug]-[4-6 char code]',
    '     Examples: "peninsula-shanghai-k3r4", "ritz-london-a7b9", "park-hotel-paris-x5m2"',
    '     Format: lowercase, hyphens, no special chars, include city for context',
    '   - selves_id: Same as slug - our unique internal identifier',
    '   - locationSlug: Generate from location (e.g., "england-norfolk-norwich")',
    '   - externalIds: Object mapping provider names to their IDs:',
    '     {',
    '       "hotelston": "HOTELCODE_VALUE_FROM_STATIC_API_DATA"',
    '     }',
    '     **IMPORTANT: Extract hotelCode from STATIC_API_DATA and set as externalIds.hotelston**',
    '     If STATIC_API_DATA has a hotelCode field, map it to externalIds.hotelston',
    '     Example: If STATIC_API_DATA.hotelCode = "50456508", then externalIds = { "hotelston": "50456508" }',
    '',
    '   **contact object:**',
    '   - phone: Normalize telephone from STATIC_API_DATA to E.164 format (e.g., +44...)',
    '   - email: Use from STATIC_API_DATA, or search official website if missing',
    '   - websiteUrl: Normalize web URL from STATIC_API_DATA to full URL (https://...)',
    '',
    '   **identity object:**',
    '   - starRating: Number 1-5, extract from either source or search reviews',
    '   - priceTier: "$", "$$", "$$$", or "$$$$" - infer from pricing data or search hotel category',
    '   - hotelType: Array like ["Boutique", "Historic", "Luxury", "Business"] - classify based on description and search results',
    '   - brandAffiliation: Chain/group name or "Independent" - search if not in data',
    '   - descriptionShort: 1-2 sentences (20-40 words). Focus on hotel character, style, and what makes it distinctive. If exists in AI_GENERATED_DATA, use as base and optionally enrich with factual details from STATIC_API_DATA englishDescription (heritage dates, architectural style, unique features). Strip all HTML tags and marketing fluff. Omit location specifics, facilities, or amenities.',
    '   - Do NOT include name field (name is at top level of document)',
    '',
    '   **location object:**',
    '   - country: Full country name (e.g., "England", "Scotland")',
    '   - region: State/province/county',
    '   - city: City name',
    '   - address: Full street address from STATIC_API_DATA or AI_GENERATED_DATA',
    '   - coordinates: {lat, lon} - Use from STATIC_API_DATA',
    '   - neighborhood: Local area/district name - extract or search for neighborhood',
    '   - walkabilityScore: Number 0-100 - search "walkability score [hotel address]" or infer from location (city center = high, suburbs = medium, rural = low)',
    '   - pointsOfInterest: Array of {name, walk_time_minutes, category} - **SEARCH for nearby attractions, museums, landmarks within 15 min walk**',
    '',
    '   **facilities object:**',
    '   - hotelAmenities: Array of strings (e.g., ["Free WiFi", "Restaurant", "Bar", "Pool", "Gym", "Spa"])',
    '   - parking: {available: boolean, onSite: boolean, cost: "Free" | "Paid" | string}',
    '   - concierge: String description or null',
    '   - airportShuttle: {available: boolean, details: string} or null',
    '   - spa: String description or null',
    '   - businessAndEvents: Array of strings (e.g., ["Meeting rooms", "Wedding venue", "Conference facilities"])',
    '   NOTE: Extract from both AI_GENERATED_DATA and STATIC_API_DATA englishDescription. **SEARCH hotel website for complete facilities list**. Merge and deduplicate.',
    '',
    '   **foodAndBeverage object:**',
    '   - restaurants: Array of {name, cuisine, awards: [], hours} - **SEARCH for restaurant names, awards (Michelin, AA Rosettes), and cuisine types**',
    '   - breakfast: {type: "Buffet" | "Continental" | "A La Carte" | string, includedInRate: boolean}',
    '   - dietaryOptions: Array of strings (e.g., ["Vegetarian", "Vegan", "Gluten-free", "Halal", "Kosher"])',
    '',
    '   **marketPosition object:**',
    '   - similarHotels: Array of {name, registryId} - **SEARCH for "hotels similar to [hotel name]" or "best hotels in [city]"**',
    '   - uniqueSellingPoints: Array of strings (key differentiators) - extract from description or **SEARCH reviews for common praise**',
    '',
    '   **media object:**',
    '   - primaryImage: {url: string, alt: string} - ONLY field needed in media object',
    '     **IMPORTANT: Use primaryMedia from STATIC_API_DATA as the primary image**',
    '     If STATIC_API_DATA has a primaryMedia object with url, use it directly',
    '     Extract the URL and create appropriate alt text',
    '     Example: If STATIC_API_DATA.primaryMedia = { url: "http://api-img.hotelston.com/...", code: "..." }',
    '              Then primaryImage = { url: "http://api-img.hotelston.com/...", alt: "Hotel name - Main photo" }',
    '     Only use web search if primaryMedia is null or missing',
    '   - Do NOT include gallery, photoCount, or socialMediaIds fields (these are managed separately)',
    '',
    '   **policies object:**',
    '   - checkInTime: Time string (e.g., "15:00") - from data or **SEARCH hotel policies**',
    '   - checkOutTime: Time string (e.g., "11:00") - from data or **SEARCH hotel policies**',
    '   - cancellationPolicy: String description - **SEARCH booking platforms for cancellation terms**',
    '   - depositRequirements: String description',
    '   - petPolicy: {petFriendly: boolean, petCharge: string, petAmenities: array} or null - **SEARCH "pet policy [hotel name]"**',
    '',
    '   **reviews object:**',
    '   - aggregate: {score: number 0-5, count: number, source: "Aggregated across Google, TripAdvisor, Booking.com"}',
    '   - scoresByCategory: {location: 0-5, cleanliness: 0-5, service: 0-5, value: 0-5}',
    '   **SEARCH for reviews on Google, TripAdvisor, Booking.com and aggregate the scores**',
    '',
    '   **sources array:**',
    '   - Array of {sourceName, referenceUrl, type, date, description}',
    '   - **ONLY include the official hotel website as a source**',
    '   - Use STATIC_API_DATA.web or search for official website',
    '   - Example: { sourceName: "Official Website", referenceUrl: "https://hotelname.com", type: "Official", date: "2025-10-02", description: "Primary hotel information source" }',
    '   - Do NOT include TripAdvisor, Booking.com, or review sites (reviews will be added separately later)',
    '',
    '   **sustainability object:**',
    '   - certifications: Array of certification names - **ONLY include if found in STATIC_API_DATA, englishDescription, or verified via search**',
    '   - practices: Array of sustainability practices - **ONLY include if explicitly mentioned in source data or search results**',
    '   - If no sustainability information is found, set to null',
    '   - Do NOT infer or assume sustainability practices - must be explicitly stated',
    '',
    '   **contentLastUpdated:**',
    '   - ISO timestamp of current date/time',
    '',
    '5. Data Enrichment Priority:',
    '   - First: Extract all available data from STATIC_API_DATA and AI_GENERATED_DATA',
    '   - Second: Parse HTML from englishDescription to extract facilities, features, and details',
    '   - Third: Use web search to fill gaps, verify information, and find additional details',
    '   - Fourth: For any field still empty after search, use null (not empty strings or arrays)',
    '   **CRITICAL: ONLY include data that is explicitly found in sources - do NOT make assumptions or infer information**',
    '   **IMPORTANT: Ranges are ENCOURAGED when source data provides them (e.g., "150-300 sqm", "$200-$500/night"). Do NOT simplify ranges to single values.**',
    '',
    '6. Search Queries to Use:',
    '   - "[hotel name] official website"',
    '   - "[hotel name] reviews TripAdvisor"',
    '   - "[hotel name] [city] nearby attractions"',
    '   - "[hotel name] restaurants awards"',
    '   - "[hotel name] pet policy"',
    '   - "[hotel name] sustainability certifications"',
    '   - "hotels similar to [hotel name] [city]"',
    '   - "walkability score [hotel address]"',
    '',
    '7. Validation:',
    '   - All nested objects must be properly structured as shown in example',
    '   - Use null for unavailable optional fields after searching, not empty strings',
    '   - Ensure arrays are present (can be empty [])',
    '   - Do NOT include any fields outside this schema',
    '   - Do NOT include room_types or rooms array (processed separately)',
    '   - Do NOT include references field (added automatically from original venue data)',
    '   - Verify all URLs are valid and complete (https://...)',
    '   - Ensure all scores are numbers between 0-5',
    '',
    'Output Specification:',
    '- The final output MUST be a single, valid JSON object.',
    '- Must exactly match the schema structure shown in the example.',
    '- Do not include any explanatory text outside of the JSON object itself.',
    '- All data should be factual and verifiable from sources.',
    '',
    '---',
    '',
    'EXAMPLE OUTPUT FORMAT:',
    '',
    hotelExampleOutput,
    '',
    '---',
    '',
    'INPUT DATA TO PROCESS:',
    '',
    JSON.stringify(combinedData, null, 2)
  ].join('\n');

  return {
    prompt: hotelPrompt,
    payload: combinedData
  };
}

export function buildResearchRoomPrompt(combinedData: any): EnrichPromptResult {
  // Extract hotel name and room names from the combined data with enhanced context
  const venueContext = combinedData?.VENUE_CONTEXT || {};
  const hotelName = venueContext.hotel_name || 
                   combinedData?.STATIC_API_DATA?.hotelName || 
                   combinedData?.AI_GENERATED_DATA?.name || 
                   'Unknown Hotel';
  
  const roomNames = Array.isArray(combinedData?.AI_GENERATED_DATA) 
    ? combinedData.AI_GENERATED_DATA.map((room: any) => room.roomName || room.name).filter(Boolean)
    : [];
    
  const venueId = venueContext.venue_id || combinedData?.venueID || combinedData?.venue_id || '';

  const roomPrompt = [
    'You are a "Researcher" data agent. Your sole task is to use web search to find and collate specific, verifiable, static facts for a list of hotel rooms.',
    '',
    '**IMPORTANT: You must research the exact hotel and rooms specified below. Do not research any other hotel.**',
    '',
    '**Hotel Context:**',
    `- Hotel Name: ${hotelName}`,
    `- Venue ID: ${venueId}`,
    `- Location: ${venueContext.location?.city || 'Unknown'}, ${venueContext.location?.country || 'Unknown'}`,
    venueContext.location?.street ? `- Address: ${venueContext.location.street}` : '',
    '',
    '**Core Principles:**',
    '1.  **FACT-GATHERING ONLY:** Do not perform analysis, create descriptions, or determine hierarchies. Your only job is to find and report facts.',
    '2.  **SEARCH-FIRST:** Use the provided hotel and room names to search official hotel sites, major booking platforms, and credible review sites.',
    '3.  **HOTEL-SPECIFIC:** Only research the exact hotel specified above. Ignore results for other hotels with similar names.',
    '4.  **LEAVE NULL IF UNVERIFIABLE:** If you cannot find a specific piece of data through search, the value for that key MUST be `null`. Do not make assumptions or fabricate data.',
    '',
    '**Input Data:**',
    'You will receive:',
    '- `venue_id`: The unique identifier for the venue (required in output as `venue_id`).',
    '- `HOTEL_NAME`: The name of the hotel.',
    '- `ROOM_NAMES`: An array of room names to research (e.g., ["Superior King Room", "Deluxe Double"]).',
    '',
    '**Processing Directives:**',
    'For each room name in the `ROOM_NAMES` array, perform the following research:',
    '',
    '1.  **Find the official room name:** Verify the exact name.',
    '2.  **Find the room size:** Look for square meter or square foot measurements.',
    '3.  **Find the bed configuration:** Note the exact bed type and count (e.g., "1 King bed", "2 Queen beds").',
    '4.  **Find the view type:** Note if a specific view is mentioned (e.g., "City view", "Cathedral view").',
    '5.  **Find a list of in-room amenities:** Collate all specific amenities listed for that room type.',
    '6.  **Find the bathroom type:** Note specific details (e.g., "Walk-in shower", "Bath and shower").',
    '7.  **Find any unique features:** List genuinely distinctive features mentioned (e.g., "Private balcony").',
    '8.  **Find specific review snippets:** Find 1-2 reviews that explicitly mention that room type.',
    '',
    '**Search Strategy:**',
    `- Search: "${hotelName} [ROOM_NAME] details"`,
    `- Search: "${hotelName} room types"`,
    `- Search: "site:booking.com ${hotelName} room amenities"`,
    `- Search: "${hotelName} [ROOM_NAME] review"`,
    venueContext.location?.city ? `- Search: "${hotelName} ${venueContext.location.city} [ROOM_NAME]"` : '',
    '',
    '**Output Specification:**',
    '- The final output MUST be a single, valid JSON object.',
    '- The root of the object should be a key named `researchedRooms`.',
    '- The value should be an array of objects, with one object for each room you researched.',
    '- Each room object MUST include a `venue_id` field set to the input `venue_id`.',
    '- Do not include any explanatory text outside of the JSON object itself.',
    '',
    '---',
    '### **Inputs:**',
    '',
    '**`venue_id`**:',
    `${venueId}`,
    '',
    '**`HOTEL_NAME`**:',
    `${hotelName}`,
    '',
    '**`ROOM_NAMES`**:',
    '```json',
    `${JSON.stringify(roomNames)}`,
    'Expected JSON Output:',
    'JSON',
    '',
    '{',
    '  "researchedRooms": [',
    '    {',
    '      "venue_id": "68a4a7c7c0cfc3faba6e44cf",',
    '      "roomName": "Superior King Room",',
    '      "sizeSqMeters": { "min": 28, "max": 30 },',
    '      "bedConfiguration": "1 King bed",',
    '      "viewType": "City view",',
    '      "amenities": [',
    '        "Air conditioning",',
    '        "Flat-screen TV",',
    '        "Coffee maker",',
    '        "Mini fridge",',
    '        "Free Wi-Fi",',
    '        "Work desk"',
    '      ],',
    '      "bathroomType": "En-suite with bath and shower",',
    '      "uniqueFeatures": ["Panoramic city view"],',
    '      "reviewSnippets": [',
    '        {',
    '          "text": "The Superior King was spacious and the city view at night was spectacular.",',
    '          "source": "Google"',
    '        }',
    '      ]',
    '    },',
    '    {',
    '      "venue_id": "68a4a7c7c0cfc3faba6e44cf",',
    '      "roomName": "Deluxe Double Room",',
    '      "sizeSqMeters": { "min": 35, "max": 35 },',
    '      "bedConfiguration": "2 Double beds",',
    '      "viewType": null,',
    '      "amenities": [',
    '        "Air conditioning",',
    '        "Flat-screen TV",',
    '        "Free Wi-Fi",',
    '        "Seating area"',
    '      ],',
    '      "bathroomType": "En-suite with walk-in shower",',
    '      "uniqueFeatures": ["Private balcony"],',
    '      "reviewSnippets": []',
    '    }',
    '  ]',
    '}',
    '',
    // ...existing code...
  ].join('\n');

  return {
    prompt: roomPrompt,
    payload: combinedData
  };
}

export function buildEnrichRoomPrompt(enrichData: any): EnrichPromptResult {
  const venueData = enrichData?.VENUE_DATA || {};
  const rankedRooms = enrichData?.RANKED_ROOM_DATA || [];
  const venue_id = enrichData?.venue_id || venueData?._id || '';

  const enrichPrompt = [
    'You are an "Enricher" data agent. Your final task is to transform ranked room data into complete registry entries for database storage.',
    '',
    '**Your Role:**',
    '1. **STRUCTURE DATA:** Convert ranked room data into the exact registry format required',
    '2. **ADD DESCRIPTIONS:** Create compelling, accurate room descriptions',
    '3. **ENHANCE MATCHING:** Build comprehensive matching criteria for search',
    '4. **VALIDATE COMPLETENESS:** Ensure all required fields are populated',
    '',
    '**Hotel Context:**',
    `- Hotel Name: ${venueData.name || 'Unknown Hotel'}`,
    `- Venue ID: ${venue_id}`,
    `- Location: ${venueData.location?.city || 'Unknown'}, ${venueData.location?.country || 'Unknown'}`,
    '',
    '**Ranked Room Data:**',
    JSON.stringify(rankedRooms, null, 2),
    '',
    '**NOTE:** Each ranked room includes a `roomId` field assigned during ranking. You MUST preserve this roomId in the identity section.',
    '',
    '**Output Format:**',
    'Transform each ranked room into this exact registry structure:',
    '',
    '[',
    '  {',
    '    "parentHotelId": "' + venue_id + '",',
    '    "identity": {',
    '      "roomId": "1",',
    '      "name": "Superior King Room",',
    '      "roomType": "Superior King",',
    '      "sizeSqMeters": { "min": 28, "max": 30 },',
    '      "maxOccupancy": 2,',
    '      "bedConfiguration": "1 King bed",',
    '      "viewType": "City view",',
    '      "descriptionShort": "Stay here if you want a bright, spacious room featuring modern décor and a panoramic city view."',
    '    },',
    '    "hierarchy": {',
    '      "tier": "Mid-range",',
    '      "upgradeFrom": "Standard Queen Room",',
    '      "upgradeTo": "Deluxe King Room"',
    '    },',
    '    "pricingContext": {',
    '      "priceTier": "$$-$$$",',
    '      "rateVsStandardRoom": "+25%"',
    '    },',
    '    "wouldMatch": {',
    '      "idealFor": ["Business travelers", "Couples seeking city views"],',
    '      "notIdealFor": ["Large families"],',
    '      "bestQueryTypes": ["superior king room city view"]',
    '    },',
    '    "features": {',
    '      "roomAmenities": ["Air conditioning", "Flat-screen TV", "Free Wi-Fi"],',
    '      "bathroomType": "En-suite with bath and shower",',
    '      "uniqueFeatures": ["Panoramic city view"],',
    '      "accessibility": null',
    '    },',
    '    "reviewSnippets": [',
    '      {',
    '        "text": "The Superior King was spacious and the city view at night was spectacular.",',
    '        "source": "Google"',
    '      }',
    '    ],',
    '    "dataConfidence": {',
    '      "verified": ["name", "bedConfiguration", "viewType"],',
    '      "estimated": ["priceTier", "rateVsStandardRoom"],',
    '      "assumptions": ["tier classification"],',
    '      "hierarchyBasis": "Compared against all room types."',
    '    }',
    '  }',
    ']',
    '',
    '**IMPORTANT:**',
    '- Return ONLY the JSON array above, with one entry per ranked room',
    '- Use all research data and ranking information provided',
    '- Ensure parentHotelId matches the venue_id: ' + venue_id,
    '- **USE the roomId from the ranked data - DO NOT generate new room numbers**',
    '- Preserve the roomId that was assigned during the ranking stage',
    '- Create compelling but accurate descriptions based on research data'
  ].join('\n');

  return {
    prompt: enrichPrompt,
    payload: enrichData
  };
}

export function buildArchitectRoomPrompt(architectData: any): EnrichPromptResult {
  // Replace template placeholders
  const venueId = architectData.venue_id;
  const venueData = architectData.VENUE_DATA || {};
  const roomData = architectData.ALL_ROOM_DATA || [];

  const architectPrompt = [
    'You are an "Architect" data agent. Your task is to transform raw, pre-researched facts about hotel rooms into comprehensive, structured, and insightful registry entries. You do **not** have access to web search tools; you must rely solely on the data provided.',
    '',
    '**CRITICAL: Output must be a valid JSON ARRAY, not an object with numbered keys.**',
    '',
    '**Core Principles:**',
    '1.  **REASONING, NOT RESEARCH:** Your job is to analyze, classify, and structure the provided data, not to find new information.',
    '2.  **HIERARCHICAL CONTEXT:** You must use the room data to accurately determine each room\'s position and value within the hotel\'s complete offering.',
    '3.  **LEAVE FIELDS NULL:** If the required information is not present in the provided data, the value MUST be `null`. Do not make assumptions.',
    '',
    '**Input Data:**',
    'You will receive:',
    '- `VENUE_DATA`: Hotel information including name, id, and other context.',
    '- `ALL_ROOM_DATA`: The array of all researched room facts for hierarchy comparison.',
    '- `venue_id`: The unique identifier for the venue.',
    '',
    '**Processing Directives:**',
    '',
    'For EACH room in ALL_ROOM_DATA, generate a complete registry entry:',
    '',
    '1.  **Identity Section:**',
    '    * `name`, `roomType`, `sizeSqMeters`, `maxOccupancy`, `bedConfiguration`, `viewType`: Use the researched facts.',
    '    * `descriptionShort`: Create a compelling 40-50 word "stay here if you want..." sales pitch based on unique features.',
    '    * `roomId`: Generate a unique roomId for each room, in hierarchy order, starting from 1 (e.g., "1", "2", "3", ...).',
    '',
    '2.  **Hierarchy Section:**',
    '    * `tier`, `upgradeFrom`, `upgradeTo`: Analyze ALL_ROOM_DATA to determine hierarchy.',
    '    * Hierarchy Logic: Compare room names (Standard < Superior < Deluxe), sizes, bed types, and views.',
    '',
    '3.  **Pricing Context:**',
    '    * `priceTier`: Estimate a tier from `$` to `$$$$` based on hierarchy position.',
    '    * `rateVsStandardRoom`: Estimate percentage difference compared to lowest-tier room.',
    '',
    '4.  **Would Match Section:**',
    '    * Generate `idealFor`, `notIdealFor`, and `bestQueryTypes` based on room features.',
    '',
    '5.  **Features Section:**',
    '    * Use researched `amenities`, `bathroomType`, `uniqueFeatures`, and `accessibility`.',
    '',
    '6.  **Review Snippets:**',
    '    * Use the `reviewSnippets` array directly from the researched facts.',
    '',
    '7.  **Data Confidence (ROOT LEVEL):**',
    '    * This object MUST be at the root level of each registry entry.',
    '',
    '**Critical Rules:**',
    `- Each entry MUST have "parentHotelId": "${venueId}"`,
    '- The output MUST be a JSON array containing one registry entry per room.',
    '- Each entry MUST have a unique `roomId` in hierarchy order.',
    '- You MUST NOT fabricate data. If a fact is not available, use `null`.',
    '',
    '---',
    '### **Inputs:**',
    '',
    '**VENUE_DATA:**',
    JSON.stringify(venueData, null, 2),
    '',
    '**ALL_ROOM_DATA:**',
    JSON.stringify(roomData, null, 2),
    '',
    `**venue_id:** ${venueId}`,
    '',
    'Expected JSON Output:',
    '[',
    '  {',
    `    "parentHotelId": "${venueId}",`,
    '    "identity": {',
    '      "roomId": "1",',
    '      "name": "Superior King Room",',
    '      "roomType": "Superior King",',
    '      "sizeSqMeters": { "min": 28, "max": 30 },',
    '      "maxOccupancy": 2,',
    '      "bedConfiguration": "1 King bed",',
    '      "viewType": "City view",',
    '      "descriptionShort": "Stay here if you want a bright, spacious room featuring modern décor and a panoramic city view."',
    '    },',
    '    "hierarchy": {',
    '      "tier": "Mid-range",',
    '      "upgradeFrom": "Standard Queen Room",',
    '      "upgradeTo": "Deluxe King Room"',
    '    },',
    '    "pricingContext": {',
    '      "priceTier": "$$-$$$",',
    '      "rateVsStandardRoom": "+25%"',
    '    },',
    '    "wouldMatch": {',
    '      "idealFor": ["Business travelers", "Couples seeking city views"],',
    '      "notIdealFor": ["Large families"],',
    '      "bestQueryTypes": ["superior king room city view"]',
    '    },',
    '    "features": {',
    '      "roomAmenities": ["Air conditioning", "Flat-screen TV", "Free Wi-Fi"],',
    '      "bathroomType": "En-suite with bath and shower",',
    '      "uniqueFeatures": ["Panoramic city view"],',
    '      "accessibility": null',
    '    },',
    '    "reviewSnippets": [',
    '      {',
    '        "text": "The Superior King was spacious and the city view at night was spectacular.",',
    '        "source": "Google"',
    '      }',
    '    ],',
    '    "dataConfidence": {',
    '      "verified": ["name", "bedConfiguration", "viewType"],',
    '      "estimated": ["priceTier", "rateVsStandardRoom"],',
    '      "assumptions": ["tier classification"],',
    '      "hierarchyBasis": "Compared against all room types."',
    '    }',
    '  }',
    ']',
    '',
    '**IMPORTANT: Return ONLY the JSON array above, with one entry per room from ALL_ROOM_DATA.**',
    '',
    // ...existing code...
  ].join('\n');

  return {
    prompt: architectPrompt,
    payload: architectData
  };
}

export function buildRankRoomPrompt(rankData: any): EnrichPromptResult {
  const venueData = rankData?.VENUE_DATA || {};
  const researchedRooms = rankData?.RESEARCHED_ROOM_DATA || [];
  const venue_id = rankData?.venue_id || venueData?._id || '';

  const rankPrompt = [
    'You are a "Ranker" data agent. Your task is to analyze researched room facts and establish hierarchies, tiers, and relationships between room types.',
    '',
    '**Your Role:**',
    '1. **ANALYZE HIERARCHIES:** Compare room sizes, amenities, views, and features to establish a logical hierarchy',
    '2. **ASSIGN TIERS:** Classify rooms into tiers (Entry-level, Mid-range, Premium, Luxury)',
    '3. **ESTABLISH RELATIONSHIPS:** Determine upgrade paths (upgradeFrom/upgradeTo)',
    '4. **PRICING CONTEXT:** Estimate relative pricing tiers and rate differences',
    '',
    '**Hotel Context:**',
    `- Hotel Name: ${venueData.name || 'Unknown Hotel'}`,
    `- Venue ID: ${venue_id}`,
    `- Location: ${venueData.location?.city || 'Unknown'}, ${venueData.location?.country || 'Unknown'}`,
    '',
    '**Researched Room Data:**',
    JSON.stringify(researchedRooms, null, 2),
    '',
    '**Ranking Guidelines:**',
    '1. **Size Hierarchy:** Larger rooms generally rank higher',
    '2. **View Quality:** Better views (city, landmark) vs internal/courtyard views',
    '3. **Amenity Level:** More premium amenities indicate higher tier',
    '4. **Bed Configuration:** Suite configurations vs standard rooms',
    '5. **Unique Features:** Special features (balcony, fireplace) increase ranking',
    '',
    '**Tier Classifications:**',
    '- **Entry-level:** Basic rooms, smallest size, standard amenities',
    '- **Mid-range:** Moderate size, good amenities, decent views',
    '- **Premium:** Larger rooms, premium amenities, better views',
    '- **Luxury:** Largest rooms, best views, most amenities, unique features',
    '',
    '**Output Format:**',
    'Return a JSON object with the structure:',
    '{',
    '  "rankedRooms": [',
    '    {',
    '      "venue_id": "' + venue_id + '",',
    '      "roomId": 1,',
    '      "roomName": "Superior King Room",',
    '      "hierarchy": {',
    '        "tier": "Mid-range",',
    '        "ranking": 2,',
    '        "upgradeFrom": "Standard Queen Room",',
    '        "upgradeTo": "Deluxe King Room"',
    '      },',
    '      "pricingEstimate": {',
    '        "priceTier": "$$",',
    '        "rateVsStandardRoom": "+25%"',
    '      }',
    '    }',
    '  ],',
    '  "venue_id": "' + venue_id + '"',
    '}',
    '',
    '**IMPORTANT:**',
    '- Keep output concise - only include hierarchy and pricing info',
    '- Do NOT duplicate the original research data',
    '- Room names must match exactly as provided in the researched data',
    '- **ASSIGN SEQUENTIAL roomId numbers (1, 2, 3, etc.) to ALL rooms in order of their ranking**',
    '- The roomId MUST be unique within this hotel and should reflect the room hierarchy'
  ].join('\n');

  return {
    prompt: rankPrompt,
    payload: rankData
  };
}

// Shared return type for prompt builders
export interface EnrichPromptResult {
  prompt: string;
  payload: any;
}
