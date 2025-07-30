import { logger } from '../../shared/logger';

export function buildAnalysisPrompt(blobJson: any, workflow: any): string {
  return `You are an expert AI multimodal analysis assistant. Your primary task is to thoroughly analyze a social media storyboard (a sequence of images representing key video frames) and the provided contextual information. Your goal is to extract precise, factual information and structure it into a JSON object according to strict rules.

### INPUT DATA ###
Below are the actual contents of the input objects:

---- BEGIN blobJson ---
${JSON.stringify(blobJson, null, 2)}
---- END blobJson ---

---- BEGIN workflow ---
${JSON.stringify(workflow, null, 2)}
---- END workflow ---

### ANALYSIS CONTEXT ###
A storyboard (sequence of images) is attached for your analysis. You must analyze the visual content of these images as the primary source of truth. Additional metadata and context are provided in the JSON above.

IMPORTANT: The canonical platform for this media is always provided in the 'source' field of the metadata object (e.g., "tiktok", "instagram", etc). Do NOT create or expect a separate 'platform' field. Use only 'source' as the platform indicator throughout your analysis and output.

STRONGLY Prioritize and Integrate: Systematically use the provided metadata (including context fields like location, country, and search query) and the workflow context to guide your analysis, especially when identifying geographic entities, specific venues, or tailoring descriptions for relevance. This context is crucial for disambiguation and precision.

### CORE INSTRUCTIONS ###
1. Comprehensive Analysis: Analyze all available data:
   - Storyboard Images: Visuals (on-screen text, logos, signage, objects, people, scenes) from the attached storyboard image sequence.
   - Provided METADATA: Examine all fields within the 'blobJson' object above.
   - Workflow Context: Use the 'workflow' object above to inform your analysis and output structure.
2. Information Hierarchy (CRITICAL):
   - ALWAYS prioritize information directly observable within the storyboard images (visuals, on-screen text, prominent branding). This is the most reliable source.
   - If visual content is ambiguous or insufficient, then (and only then) refer to textual information found in the METADATA (e.g., caption, adminTitle).
   - If there is a discrepancy between visuals and metadata text, the storyboard images MUST TAKE PRECEDENCE.
3. Strict Output Format: Construct a JSON object adhering precisely to the structure and field-specific rules detailed below.

### FIELD-BY-FIELD RULES ###

context: Replicate the entire verbatim 'context' object that was provided in the input 'metadata'. This is crucial for downstream processing. Its structure will be: { "l": "city", "cc": "country_code", "w": "search_query" }.
_id, mediaId, source, permalink: Copy these values directly from the metadata object without modification. The 'source' field is the ONLY platform indicator; do NOT create or use a separate 'platform' field.
username: Use the value from metadata.username if available. Otherwise, extract the most appropriate username from the permalink URL.
createdAt, updatedAt, date: Always return these as string representations of dates. If a date is unknown or cannot be determined, use an empty string "". Do not use null.
mediaType: Categorize the content as "video", "carousel", "image", or "other" based on its primary format.
adminTitle:
  - If metadata.adminTitle is present, use it. If it's lengthy or informal, optimize it into a concise, SEO-friendly title (under 10 words) suitable for a website, prioritizing keywords relevant to the query if applicable.
  - If metadata.adminTitle is missing or empty, generate a compelling, short title (under 10 words) that accurately summarizes the main subject, heavily leveraging keywords from the original query provided in the context.
slug: Create a unique, URL-friendly slug.
  - Derive it from the final adminTitle and mediaId (e.g., "A Cool Place!" with mediaId "123" -> "a-cool-place-123").
  - If adminTitle is empty, generate the slug from a relevant part of the permalink.
caption:
  - Use the value from metadata.caption or fallback to the adminTitle if the caption is empty.
  - Tidy: Remove excessive whitespace, line breaks, emojis, redundant punctuation, advertising slogans, and external links (anything not directly describing the content). Focus on a clean, descriptive narrative.
mediaDescription: Provide a long, objective, and detailed summary of the distinct visual elements and actions observed in the storyboard images. Focus exclusively on what can be seen. Do NOT include opinions, subjective interpretations, or information not visually present.
  - Example: "We see a person riding a blue bicycle past historical landmarks in London, including Big Ben and the Houses of Parliament, on a sunny day."
  - Identify specific, bookable venues or businesses (e.g., hotels, restaurants, cafes, ticketed attractions, museums with specific names like "The Natural History Museum").
  - DO NOT include general geographic areas like cities, countries, or non-specific neighborhoods.
  - Priority Rules for Identification:
    1. Visual Evidence: If a specific venue name, branding, or distinctive logo is clearly and unambiguously visible within the storyboard images (e.g., on a sign, cup, storefront, menu), ALWAYS use this precise name. Assign a high confidence score.
    2. Contextual Refinement: After visual identification, or if visual information is ambiguous, leverage the location, country, and query from the analysis context to refine identification, disambiguate similar names, or confirm the specific branch/location of a chain.
    3. Textual Fallback: If visual evidence and context are insufficient, then consult names or descriptions from the textual metadata (caption, adminTitle).
  - For each identified place, provide a name and a confidence score (a float between 0.0 and 1.0, where 1.0 is absolute certainty from visual proof).
locations:
  - Identify well-known, non-bookable public points of interest or natural landmarks (e.g., city squares, bridges, parks, monuments, specific beaches, mountain ranges).
  - DO NOT include specific businesses or generic geographic areas.
  - Priority Rules for Identification:
    1. Visual Evidence: Prioritize visual identification from the storyboard images (e.g., a clearly recognizable monument, bridge, or natural feature).
    2. Contextual Refinement: Leverage the location, country, and query from the analysis context to help identify, confirm, or disambiguate locations, especially when visual cues are subtle or could apply to multiple places.
    3. Textual Fallback: If visual evidence and context are insufficient, then consult names or descriptions from the textual metadata.
  - For each identified location, provide a name and a confidence score (a float between 0.0 and 1.0, where 1.0 is absolute certainty from visual proof).
Default Value Handling: If a value for any field (not explicitly covered by "empty string" or "null" rules above) cannot be determined from any source, set its value to null. Do not invent information.

### CRITICAL OUTPUT FORMAT RULES ###

- OUTPUT FORMAT: Your final output MUST BE a single, perfectly valid JSON object.
- NO EXTRA TEXT: Do not include any preambles, explanations, apologies, comments, or any text/characters outside of the JSON object.
- JSON VALIDITY: Ensure absolutely no trailing commas in arrays or objects. All strings must be correctly quoted and escaped.
- INDENTATION: Use 2-space indentation for readability within the JSON.

### EXAMPLE OUTPUT ###

{
  "_id": "media_98765",
  "mediaId": "v54321",
  "source": "instagram",
  "permalink": "https://www.instagram.com/p/CXYZUVW/london_places/",
  "username": "londonwanderer",
  "createdAt": "2023-10-26T10:30:00Z",
  "date": "2023-10-26",
  "adminTitle": "Exploring London's Historic Tower Bridge Area",
  "caption": "Had such an amazing day near #TowerBridge in London! Definitely recommend this area for families. 🇬🇧🤩 #London #FamilyFun #UK #Travel @TowerBridge @TheShardLondon.",
  "mediaDescription": "this video shows a family walking near Tower Bridge in London, with views of the Shard in the background. The area is bustling with tourists and locals enjoying the sunny day.",
  "context": {
    "l": "London",
    "cc": "GB",
    "w": "London attractions, family fun"
  }
}
`;
}
