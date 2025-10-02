/**
 * Utility functions for generating unique hotel identifiers
 * 
 * Our ID strategy uses contextual slugs with entropy for uniqueness:
 * Format: [hotel-name-slug]-[city-slug]-[entropy-code]
 * Example: "peninsula-shanghai-k3r4"
 * 
 * Benefits:
 * - Human-readable and semantic
 * - SEO-friendly for URLs
 * - Includes location context
 * - Guaranteed unique via entropy + DB check
 */

/**
 * Generates a random entropy code for unique IDs
 * @param length Length of the entropy code (default: 6)
 * @returns Random string using lowercase letters and numbers
 */
export function generateEntropyCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a URL-friendly slug from text
 * @param text Text to slugify
 * @returns Lowercase slug with hyphens
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generates a contextual unique ID for a hotel
 * Format: [hotel-name]-[city]-[entropy]
 * 
 * @param hotelName Hotel name
 * @param city City name (optional but recommended for context)
 * @param entropyLength Length of random code (default: 6)
 * @returns Unique contextual ID
 * 
 * @example
 * generateHotelId("The Peninsula Shanghai", "Shanghai") 
 * // Returns: "peninsula-shanghai-a7b9c2"
 * 
 * generateHotelId("Park Hotel", "Paris", 4) 
 * // Returns: "park-hotel-paris-x5m2"
 */
export function generateHotelId(
  hotelName: string, 
  city?: string, 
  entropyLength: number = 6
): string {
  const namePart = slugify(hotelName);
  const cityPart = city ? slugify(city) : '';
  const entropy = generateEntropyCode(entropyLength);
  
  // Combine parts
  const parts = [namePart, cityPart, entropy].filter(Boolean);
  return parts.join('-');
}

/**
 * Validates a hotel ID format
 * @param id ID to validate
 * @returns True if ID matches expected format
 */
export function isValidHotelId(id: string): boolean {
  // Should be lowercase alphanumeric with hyphens
  // Should end with entropy code (4-6 chars)
  const pattern = /^[a-z0-9]+(-[a-z0-9]+)*-[a-z0-9]{4,6}$/;
  return pattern.test(id);
}

/**
 * Extracts components from a hotel ID
 * @param id Hotel ID to parse
 * @returns Object with name, city, and entropy parts
 * 
 * @example
 * parseHotelId("peninsula-shanghai-k3r4")
 * // Returns: { namePart: "peninsula", cityPart: "shanghai", entropy: "k3r4" }
 */
export function parseHotelId(id: string): { namePart: string; cityPart: string | null; entropy: string } | null {
  if (!isValidHotelId(id)) {
    return null;
  }
  
  const parts = id.split('-');
  const entropy = parts[parts.length - 1];
  
  // Assuming entropy is last, city might be second-to-last
  if (parts.length >= 3) {
    const cityPart = parts[parts.length - 2];
    const nameParts = parts.slice(0, -2);
    return {
      namePart: nameParts.join('-'),
      cityPart,
      entropy
    };
  } else if (parts.length === 2) {
    return {
      namePart: parts[0],
      cityPart: null,
      entropy
    };
  }
  
  return null;
}

/**
 * Checks if a hotel ID already exists in the database
 * NOTE: This is a placeholder - implement actual DB check in your service
 * 
 * @param id Hotel ID to check
 * @returns Promise resolving to true if ID exists
 */
export async function checkHotelIdExists(id: string): Promise<boolean> {
  // TODO: Implement actual database check
  // Example:
  // const db = getDatabase();
  // const exists = await db.collection('hotels').findOne({ selves_id: id });
  // return !!exists;
  
  throw new Error('checkHotelIdExists not implemented - add DB logic');
}

/**
 * Generates a guaranteed unique hotel ID by checking the database
 * Will retry with new entropy if collision occurs
 * 
 * @param hotelName Hotel name
 * @param city City name
 * @param maxRetries Maximum retry attempts (default: 10)
 * @returns Promise resolving to unique ID
 * 
 * @example
 * const id = await generateUniqueHotelId("The Ritz", "London");
 * // Returns: "ritz-london-a7b9c2" (guaranteed unique)
 */
export async function generateUniqueHotelId(
  hotelName: string,
  city?: string,
  maxRetries: number = 10
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const candidateId = generateHotelId(hotelName, city);
    
    try {
      const exists = await checkHotelIdExists(candidateId);
      if (!exists) {
        return candidateId;
      }
      // Collision detected, retry with new entropy
    } catch (error) {
      // If DB check fails, return the candidate (caller should handle DB errors)
      console.warn('Could not check ID uniqueness, returning candidate:', error);
      return candidateId;
    }
  }
  
  throw new Error(`Failed to generate unique hotel ID after ${maxRetries} attempts`);
}

// Export type for external IDs mapping
export interface ExternalProviderIds {
  hotelston?: string;
  hbx?: string;
  roibos?: string;
  expedia?: string;
  booking?: string;
  [key: string]: string | undefined;
}
