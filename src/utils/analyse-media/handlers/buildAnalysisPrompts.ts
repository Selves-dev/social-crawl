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
    'You are an expert at extracting structured information from *specific, individual business* venue data, focusing on the travel and tourism sectors.',
    '',
    'CRITICAL: You MUST respond with ONLY valid JSON. No explanations, no markdown, no text outside the JSON object.',
    'If no *specific, non-chain, travel/tourism business* venue information is found, or if the venue name is unclear or generic, return a JSON object with "name": "No venue found".',
    '',
    'Given the following payload (which may contain a venue object as payload.venue):',
    '',
    'The workflow context may contain the following fields to help you disambiguate and find the correct venue:',
    `- l: The location (city) that was searched for. Value: ${workflow?.l ?? ''}`,
    `- cc: The country code (e.g., "US" for United States, "FR" for France) where the venue is located. Value: ${workflow?.cc ?? ''}`,
    `- w: The query or keywords used to find the social video this venue is based on. Value: ${workflow?.w ? JSON.stringify(workflow.w) : ''}`,
    'Use these fields to provide additional context when searching for or extracting venue information.',
    '**Prioritize identifying specific, unique, non-chain businesses within the categories of hotels, restaurants, experiences (e.g., tour operators, activity centers), theaters, museums, art galleries, and other cultural or leisure attractions.**',
    'Exclude generic descriptions (e.g., "cheap hotel london," "Indian restaurant"), broad categories, multi-vendor markets (like "Greenwich Market"), and chain establishments (e.g., "Premier Inn," "McDonald\'s").',
    'The extracted venue name must be a precise, identifiable business name.',
    '- The venue name (as complete as possible) from the venue data. This MUST be the unique name of the business, not a generic description.',
    '- The full address (as a single string, as complete as possible) from the venue data. If the venue data does not contain the address, use Google Search to find the most accurate and complete address.',
    '- The postcode (if present) from the venue data. If the venue data does not contain the postcode, use Google Search to find it.',
    '- If the venue is a hotel, also extract a list of room types (e.g., Single, Double, Suite, etc.) from the venue data. If the venue data does not indicate it\'s a hotel or list room types, assume it\'s not a hotel and return an empty list.',
    '',
    'Return a JSON object with this exact structure:',
    '{',
    '  "name": string,',
    '  "location": {',
    '    "address": string,',
    '    "postcode": string',
    '  },',
    '  "rooms": [',
    '    { "name": string }',
    '  ]',
    '}',
    '',
    'Notes:',
    '- Always include the "location" object with "address" and "postcode" fields, populated with the best available information from the payload or search.',
    '- Always include the "rooms" array. If not a hotel or no room types are found, use an empty array: "rooms": [].',
    '- If a field cannot be determined even with search, use an empty string or empty array as appropriate.',
    '- If no venue name is provided or found, or if the venue is generic or a chain, use "name": "No venue found".',
    '- NEVER return explanatory text. ALWAYS return valid JSON only.',
    '',
    '--- PAYLOAD ---',
    JSON.stringify(payload, null, 2),
    '--- END PAYLOAD ---',
    '',
    workflow ? '--- WORKFLOW CONTEXT ---' : '',
    workflow ? JSON.stringify(workflow, null, 2) : '',
    workflow ? '--- END WORKFLOW CONTEXT ---' : '',
  ].filter(Boolean).join('\n');
}