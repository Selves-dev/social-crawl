import { logger } from '../../shared/logger';
export function buildAnalysisPrompt(blobJson: any, workflow: any): string {
  // Sanitize and truncate blob JSON to prevent token limit issues
  const sanitizedBlobJson = {
    mediaId: blobJson.mediaId || null,
    link: blobJson.link || null,
    username: blobJson.username || null,
    title: blobJson.title || "",
    caption: blobJson.caption || "",
    viewCount: blobJson.viewCount || null,
    likeCount: blobJson.likeCount || null,
    date: blobJson.date || null,
    source: blobJson.source || null,
    // Only include essential workflow data
    workflow: {
      l: blobJson.workflow?.l || null,
      cc: blobJson.workflow?.cc || null,
      w: blobJson.workflow?.w || []
    }
  };

  return [
    'You are a highly intelligent AI assistant specialized in analyzing media content and extracting structured data based on a specific JSON schema.',
    'Our aim is to ultimately create a knowledge graph of travel, tourism and related businesses such as restaurants, hotels, experiences, museums, tours and theatres from social media content.',
    'Your task is to analyze the provided media data and workflow context to generate a single, valid JSON object.',
    '',
    'IMPORTANT: Your response MUST be ONLY valid JSON. Do NOT include any explanations, markdown, or extra text. Do NOT wrap the JSON in code blocks. Output ONLY the JSON object.',
    '',
    '### INPUT DATA ###',
    '--- MEDIA DATA ---',
    `mediaId: ${sanitizedBlobJson.mediaId || 'N/A'}`,
    `link: ${sanitizedBlobJson.link || 'N/A'}`,
    `username: ${sanitizedBlobJson.username || 'N/A'}`,
    `title: ${sanitizedBlobJson.title || 'N/A'}`,
    `caption: ${sanitizedBlobJson.caption || 'N/A'}`,
    `viewCount: ${sanitizedBlobJson.viewCount || 'null'}`,
    `likeCount: ${sanitizedBlobJson.likeCount || 'null'}`,
    `date: ${sanitizedBlobJson.date || 'N/A'}`,
    `source: ${sanitizedBlobJson.source || 'N/A'}`,
    `workflow: ${sanitizedBlobJson.workflow ? `l=${sanitizedBlobJson.workflow.l}, cc=${sanitizedBlobJson.workflow.cc}, w=[${sanitizedBlobJson.workflow.w?.join(', ') || ''}]` : 'N/A'}`,
    '--- END MEDIA DATA ---',
    '',
    '--- WORKFLOW CONTEXT ---',
    `batchId: ${workflow?.batchId || 'N/A'}`,
    `stage: ${workflow?.stage || 'N/A'}`,
    `timestamp: ${workflow?.timestamp || 'N/A'}`,
    `l: ${JSON.stringify(workflow?.l || null)}`,
    `cc: ${JSON.stringify(workflow?.cc || null)}`,
    `w: ${JSON.stringify(workflow?.w || [])}`,
    '--- END WORKFLOW CONTEXT ---',
    '',
    '### REQUIRED OUTPUT FIELDS ###',
    '* **title**: Main title for display. Use adminTitle if present, otherwise create from content.',
    '* **slug**: URL-friendly identifier combining title and mediaId (lowercase, hyphens, no special chars)',
    '* **caption**: Clean version of caption/title (remove excess whitespace, emojis, redundant punctuation)',
    '* **mediaDescription**: Array of strings describing visual elements objectively',
    '* **likeCount**: Number from input data or null',
    '* **viewCount**: Number from input data or null',
    '* **venues**: Array of bookable BUSINESSES with name and confidence (0.0-1.0). These are places we would be able to send marketing materials to, who may sign up for our services',
    '* **locations**: Array of landmarks/tourist sites with name and confidence (0.0-1.0)',
    '* **context**: Object with (REQUIRED - ALWAYS INCLUDE):',
    '  - l: Copy exactly from WORKFLOW CONTEXT.l (string or null)',
    '  - cc: Copy exactly from WORKFLOW CONTEXT.cc (string or null)', 
    '  - w: Copy exactly from WORKFLOW CONTEXT.w (array of strings, never empty array if original has values)',
    '',
    '### OUTPUT FORMAT ###',
    'Return ONLY a valid JSON object with 2-space indentation. No explanations, no markdown, no extra text, no code blocks.',
    'CRITICAL: The "context" field is mandatory and must always preserve the workflow values from WORKFLOW CONTEXT.',
    '',
    '### EXAMPLE ###',
    '{',
    '  "title": "Hotel Experience in City",',
    '  "slug": "hotel-experience-city-12345",',
    '  "caption": "Great stay at this hotel",',
    '  "mediaDescription": ["Hotel exterior view", "Interior lobby area"],',
    '  "likeCount": 41,',
    '  "viewCount": 8349,',
    '  "venues": [{"name": "Hotel Name", "confidence": 0.8}],',
    '  "locations": [],',
    '  "context": {"l": "lille", "cc": "france", "w": ["things to do in lille"]}',
    '}'
  ].join('\n');
}

// Alternative function with better error handling
export function buildAnalysisPromptSafe(blobJson: any, workflow: any): { prompt: string; tokenEstimate: number } {
  try {
    const prompt = buildAnalysisPrompt(blobJson, workflow);
    // Rough token estimate (1 token ≈ 4 characters)
    const tokenEstimate = Math.ceil(prompt.length / 4);
    
    // If prompt is too long, create a shorter version
    if (tokenEstimate > 3000) {
      const shortBlobJson = {
        mediaId: blobJson.mediaId,
        caption: blobJson.caption?.substring(0, 200) || "",
        title: blobJson.title?.substring(0, 100) || "",
        viewCount: blobJson.viewCount,
        likeCount: blobJson.likeCount,
        workflow: {
          l: blobJson.workflow?.l,
          cc: blobJson.workflow?.cc,
          w: blobJson.workflow?.w?.slice(0, 3) || []
        }
      };
      
      const shortPrompt = buildAnalysisPrompt(shortBlobJson, workflow);
      return {
        prompt: shortPrompt,
        tokenEstimate: Math.ceil(shortPrompt.length / 4)
      };
    }
    
    return { prompt, tokenEstimate };
  } catch (error) {
    console.error('Error building prompt:', error);
    throw new Error('Failed to build analysis prompt');
  }
}

export function buildVenueBasicsPrompt(payload: any, workflow?: any): string {
  return [
    'You are a meticulous research agent. Your mission is to compile a complete, two-part dossier on a specific travel/tourism venue and then combine them into a single JSON output. You must perform the steps in the specified order. User Grounding with Search wherever possible',
    '',
    'CRITICAL: Your entire output must be ONLY a single, valid JSON object. Do not include any explanations or text outside the JSON structure.',
    'If the provided venue is not a valid, specific, non-chain travel/tourism entity, you MUST return `{"name": "No venue found", "category": null, "location": null, "contact": null, "attributes": null, "hotelDetails": null, "onlinePresence": null}`.',
    '',
    '--- MISSION OVERVIEW ---',
    'You will perform this mission in two distinct steps, IN ORDER. First, you will find published content. Second, you will gather the core facts. Finally, you will combine the results into one final JSON object.',
    '',
    '--- STEP 1: PUBLISHED CONTENT ANALYSIS (DO THIS FIRST) ---',
    'Your first task is to find **up to 10 of the highest-quality and most relevant** published works about the venue specified in the payload. Use the provided location context to ensure you are researching the correct entity.',
    `Location Context: **City: "${workflow?.l ?? 'MISSING'}", Country: "${workflow?.cc ?? 'MISSING'}"**`,
    'Each item you find **must pass three non-negotiable checks** to be included:',
    '',
    '1.  **CHECK 1: SOURCE QUALITY**',
    '    - **VALID SOURCES**: Journalistic Articles (The Telegraph, etc.), Official Guides (Michelin Guide, etc.), and Established Travel Blogs.',
    '    - **INVALID SOURCES**: E-commerce/booking sites (Booking.com, Expedia, etc.) and user-review aggregators (TripAdvisor, Yelp, etc.). These are strictly forbidden.',
    '',
    '2.  **CHECK 2: URL INTEGRITY**',
    '    - The URL must be the final, public-facing URL. Internal search links (containing "google.com/grounding") are invalid.',
    '',
    '3.  **CHECK 3: RECENCY (CRITICAL)**',
    '    - **If a publication date IS found:** The date **must be recent (within the last 2 years)**. If it is older, it is considered outdated and **you MUST exclude it.**',
    '    - **If a publication date IS NOT found:** The content is considered **evergreen and you MUST include it**. The `publicationDate` for this item must be `null`.',
    '',
    '--- STEP 2: COMPILE THE FACTUAL DOSSIER ---',
    'Now, using the information from the venue you identified in Step 1, complete the rest of the dossier. Find and verify all the factual data for the following sections:',
    '- `name`, `category`',
    '- `location` (fullAddress, street, city, etc.)',
    '- `contact` (phone, email, website)',
    '- `attributes` (priceRange, openingHours, keyFeatures)',
    '- `hotelDetails` (if it is a hotel, otherwise `roomTypes` is an empty array)',
    '- `onlinePresence` (bookingUrl, socialMedia)',
    '',
    '--- FINAL ASSEMBLY ---',
    'Combine the results from Step 1 (Published Content) and Step 2 (Factual Data) into a single JSON object with the exact structure below. Ensure every section is present and complete.',
    '',
    '--- FINAL JSON STRUCTURE ---',
    '{',
    '  "name": "string",',
    '  "category": "string",',
    '  "location": { "fullAddress": "string", "street": "string", "city": "string", "state_province": "string", "postcode": "string", "country": "string" },',
    '  "contact": { "phone": "string", "email": "string", "website": "string" },',
    '  "attributes": { "price": "string" },',
    '  "hotelDetails": { "keyFeatures": ["string"], "roomTypes": [ { "name": "string", "description": "string", "amenities": ["string"] } ] },',
    '  "publishedContent": [',
    '    {',
    '      "sourceName": "string",',
    '      "articleTitle": "string",',
    '      "author": "string | null",',
    '      "url": "string",',
    '      "contentType": "Journalistic Article | Guide Listing | Blog Post",',
    '      "publicationDate": "YYYY-MM-DD | null"',
    '    }',
    '  ]',
    '}',
    '',
    '--- PAYLOAD ---',
    JSON.stringify(payload, null, 2),
    '--- END PAYLOAD ---',
  ].filter(Boolean).join('\n');
}