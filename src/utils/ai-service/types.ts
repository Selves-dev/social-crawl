/**
 * AI Service Types
 * Simple types for Gemma 3n AI model deployment (latest efficient model)
 */

export interface GemmaModelConfig {
  // Azure Container Instance configuration
  azure: {
    endpoint: string     // Container URL (e.g., http://gemma-3n-e4b-uk.uksouth.azurecontainer.io:8080)
    apiKey?: string      // Optional authentication
  }
  
  // Gemma 3n model settings
  model: {
    size: 'google/gemma-3n-E2B' | 'google/gemma-3n-E4B' | 'unsloth/gemma-3n-E2B-bnb-4bit'  // HuggingFace Gemma 3n model names
    maxTokens: number
    temperature: number
    functionCalling?: boolean  // Enable function calling capabilities
  }
}

export interface AIServiceConfig {
  gemma: GemmaModelConfig
  timeout: number // Request timeout in milliseconds
}

export interface AIAnalysisRequest {
  prompt: string
  maxTokens?: number
  temperature?: number
  // Multimodal support for Gemma 3n
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

export interface AIAnalysisResult {
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
      content?: string      // Actual scraped content that was sent to Gemma
    }>
    functionCalls?: Array<{  // Track function calls made
      name: string
      arguments: any
      result: any
    }>
  }
  error?: string
}
