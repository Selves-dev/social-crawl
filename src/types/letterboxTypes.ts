/**
 * Letterbox Interface
 * 
 * A letterbox receives mail from the PostOffice and handles internal office routing.
 * This includes putting messages in internal trays (throttle queues), calling handlers, etc.
 * 
 * Letterboxes are internal post office workers - they don't send mail back to external queues.
 */
export interface LetterboxHandler {
  (message: any): Promise<any>;
}

/**
 * Postal Service Message Format
 * Standardized message structure for all postal service routing
 */
export interface PostalMessage {
  util: string
  type: string
  workflow: any
  payload: any
}
