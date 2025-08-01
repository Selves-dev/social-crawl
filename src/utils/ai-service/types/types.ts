// import type { WorkflowContext } from '../../shared/workflowTracker'

export interface AIResponseHandler {
 
  type: string

  config: Record<string, any>
}


export type ModelType = 'text' | 'text_image' | 'text_audio'

export interface AIQueueMessage {
  modelType: ModelType
  prompt: string
  
  blobUrl?: string
  mediaUrl?: string

  workflow: any
  options?: Record<string, any>
  responseHandler: AIResponseHandler

  meta?: Record<string, any>
}

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
