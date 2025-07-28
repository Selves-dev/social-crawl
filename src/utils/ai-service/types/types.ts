import type { WorkflowContext } from '../../shared/workflowTracker'

/**
 * Describes how the AI response should be delivered or handled downstream (e.g., by Postman)
 */
export interface AIResponseHandler {
  /**
   * The type of handler (e.g., 'postman', 'webhook', etc.)
   */
  type: string
  /**
   * Handler-specific configuration (e.g., callback URL, postman queue name, etc.)
   */
  config: Record<string, any>
}

/**
 * Generic AI queue message for model-agnostic processing
 */
export type ModelType = 'text' | 'text_image' | 'text_audio'

export interface AIQueueMessage {
  modelType: ModelType
  prompt: string
  /**
   * URL to an Azure blob containing a JSON manifest of files (images, audio, etc.) to use with the prompt
   */
  blobUrl?: string
  options?: Record<string, any> // Model options (temperature, maxTokens, etc.)
  workflow: WorkflowContext
  responseHandler: AIResponseHandler
  /**
   * Any additional metadata for tracing/debugging
   */
  meta?: Record<string, any>
}
/**
 * AI Service Types
 * AI Service Types for text and multimodal models
 */

// ...Gemma model types removed...

interface AIServiceConfig {
  timeout: number // Request timeout in milliseconds
}

interface AIAnalysisRequest {
  prompt: string
  maxTokens?: number
  temperature?: number
  // Multimodal support
  imageUrl?: string        // URL to image or video (supports GCS: gs://bucket/path, HTTP URLs)
  imageData?: string       // Base64 encoded image data
  audioData?: string       // Base64 encoded audio data (6.25 tokens per second)
  videoUrl?: string        // URL to video file (supports GCS and HTTP)
  mediaType?: 'image' | 'video' | 'audio' // Explicit media type for processing
  // Google grounding options
  useWebSearch?: boolean   // Enable real-time Google search for context
  searchQuery?: string     // Override search query (defaults to prompt)
  maxSearchResults?: number // Number of search results to include (default: 3)
  // Function calling options
  enableFunctions?: boolean // Enable function calling for web search
  availableFunctions?: string[] // List of available functions ['web_search', 'scrape_url']
}

interface AIAnalysisResult {
  success: boolean
  text: string
  processingTime: number
  tokensUsed?: number
  model?: string
  multimodal?: {
    imageSupport: boolean
    audioSupport: boolean
  }
  grounding?: {
    searchUsed: boolean
    searchResults?: Array<{
      title: string
      snippet: string
      url: string
      content?: string      // Actual scraped content sent to the model
    }>
    functionCalls?: Array<{  // Track function calls made
      name: string
      arguments: any
      result: any
    }>
  }
  error?: string
}
