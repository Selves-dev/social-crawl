import { logger } from '../../shared/logger';

/**
 * Constructs a prompt for an AI to analyze media metadata (blobJson) and extract a structured JSON object.
 * This function defines the rules for extracting fields like captions, descriptions, locations, and other contextual data.
 *
 * @param blobJson - The primary media data object.
 * @param workflow - Additional context for the analysis task.
 * @returns A formatted string prompt for the AI.
 */
export function buildAnalysisPrompt(blobJson: any, workflow: any): string {
  return [
    'You are a highly intelligent AI assistant specialized in analyzing media content and extracting structured data based on a specific JSON schema.',
    'Your task is to analyze the provided media data (blobJson) and workflow context to generate a single, valid JSON object. Follow the rules for each field precisely.',
    '',
    '### INPUT DATA ###',
    '--- BLOB JSON ---',
    JSON.stringify(blobJson, null, 2),
    '--- END BLOB JSON ---',
    '',
    '--- WORKFLOW CONTEXT ---',
    JSON.stringify(workflow, null, 2),
    '--- END WORKFLOW CONTEXT ---',
    '',
    '### FIELD DEFINITIONS & RULES ###',
    '* **caption**: From blobJson.caption or fallback to adminTitle. Tidy: remove excess whitespace, line breaks, emojis, redundant punctuation, slogans, external links. Focus on clean narrative.',
    '* **mediaDescription**: Long, objective, detailed summary of distinct visual elements and actions in storyboard images. Only what is seen. No opinions or subjective interpretations.',
    '* **likeCount**: (number) Copy directly from blobJson.If not present or invalid, use null.',
    '* **viewCount**: (number) Copy directly from blobJson. If not present or invalid, use null.',
    '* **places**: (array of objects) Specific, bookable venues/businesses, or well-defined landmarks that are distinct points of interest (e.g., hotels, restaurants, museums, specific bridges, specific towers). Each object must have:',
    '    * **name**: (string) The name of the place.',
    '    * **confidence**: (float 0.0-1.0) Confidence score; 1.0 for visual certainty.',
    '    * **Prioritization**: Clear visual name/logo (e.g., sign, cup, storefront) > Contextual refinement (using blobJson context, query) > Textual fallback (caption, adminTitle).',
    '* **locations**: (array of objects) Well-known, non-bookable geographic areas (e.g., cities, countries, regions, general public parks, mountains, natural formations). Each object must have:',
    '    * **name**: (string) The name of the location.',
    '    * **confidence**: (float 0.0-1.0) Confidence score; 1.0 for visual certainty.',
    '    * **Prioritization**: Clear visual identification > Contextual refinement (using blobJson context, query) > Textual fallback (caption, adminTitle).',
    '* **context**: (object) Provides high-level geographic and keyword context. **IMPORTANT: The values for this object are provided in the WORKFLOW CONTEXT and MUST be copied directly.**',
    '    * **l**: (string) **CRITICAL RULE:** Copy this value **directly** from the `workflow.l` field in the WORKFLOW CONTEXT input. **DO NOT** derive, infer, or change this value based on your analysis of the blobJson.',
    '    * **cc**: (string) **CRITICAL RULE:** Copy this value **directly** from the `workflow.cc` field in the WORKFLOW CONTEXT input. **DO NOT** derive, infer, or change this value.',
    '    * **w**: (string) **CRITICAL RULE:** Copy this value **directly** from the `workflow.w` field in the WORKFLOW CONTEXT input. **DO NOT** create a new list of keywords.',
    '* **Default Values**: If a field value cannot be determined and no specific rule applies, use null. Do not invent info.',
    '',
    '### CRITICAL OUTPUT FORMAT RULES ###',
    '* **Format**: Single, valid JSON object.',
    '* **No Extra Text**: No preambles, explanations, or comments.',
    '* **Validity**: No trailing commas. Correctly quoted/escaped strings.',
    '* **Indentation**: 2-space.',
    '',
    '### EXAMPLE OUTPUT ###',
    // Note: The example provided in the prompt is illustrative and may not match the fields requested above. The AI should prioritize the "FIELD DEFINITIONS & RULES" section.
    '{"caption":"Had such an amazing day near Tower Bridge in London! Definitely recommend this area for families.","mediaDescription":"This video shows a family walking near Tower Bridge in London, with views of the Shard in the background. The area is bustling with tourists and locals enjoying the sunny day.","likeCount":15230,"viewCount":876543,"places":[{"name":"Tower Bridge","confidence":1.0},{"name":"The Shard London","confidence":0.9}],"locations":[{"name":"London","confidence":1.0},{"name":"UK","confidence":1.0}],"context":{"l":"London","cc":"GB","w":"TowerBridge London FamilyFun UK Travel"}}',
  ].join('\n');
}

/**
 * Constructs a prompt for an AI to extract basic venue information from a payload.
 * This function targets the address, postcode, and room types (if applicable).
 *
 * @param payload - The object containing venue data, typically as `payload.venue`.
 * @returns A formatted string prompt for the AI.
 */
export function buildVenueBasicsPrompt(payload: any, workflow?: any): string {
  return [
    'You are an expert at extracting structured information from venue data.',
    '',
    'Given the following payload (which may contain a venue object as payload.venue), extract:',
    '- The venue name (as complete as possible) from the venue data',
    '- The full address (as a single string, as complete as possible) from the venue data',
    '- The postcode (if present) from the venue data',
    '- If the venue is a hotel, also extract a list of room types (e.g., Single, Double, Suite, etc.)',
    '',
    'Return a JSON object with these fields:',
    '{',
    '  "name": string,',
    '  "address": string,',
    '  "postcode": string,',
    '  "roomTypes"?: string[]',
    '}',
    '',
    '--- PAYLOAD ---',
    JSON.stringify(payload, null, 2),
    '--- END PAYLOAD ---',
    '',
    workflow ? '--- WORKFLOW CONTEXT ---' : '',
    workflow ? JSON.stringify(workflow, null, 2) : '',
    workflow ? '--- END WORKFLOW CONTEXT ---' : '',
    '',
    'If a field cannot be determined, use an empty string or empty array as appropriate.',
  ].filter(Boolean).join('\n');
}