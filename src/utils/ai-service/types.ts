/**
 * AI Service Types
 * Comprehensive types for video and text processing
 */

export type AIProvider = 'llama-3.1-70b' | 'llama-3.1-405b' | 'gpt-4o' | 'azure-video-intelligence' | 'gemini-pro' | 'gemma-2-9b' | 'gemma-2-27b' | 'gemma-2-2b'

export interface AIServiceConfig {
  providers: {
    llama?: {
      endpoint: string
      apiKey: string
      model: 'llama-3.1-70b' | 'llama-3.1-405b'
      maxTokens?: number
    }
    openai?: {
      apiKey: string
      model: 'gpt-4o' | 'gpt-4o-mini'
      maxTokens?: number
    }
    azure?: {
      videoIntelligence?: {
        endpoint: string
        apiKey: string
        subscriptionKey: string
      }
    }
    gemini?: {
      apiKey: string
      model: 'gemini-1.5-pro' | 'gemini-1.5-flash'
      maxTokens?: number
    }
    gemma?: {
      endpoint: string
      apiKey?: string // Optional for self-hosted
      model: 'gemma-2-2b' | 'gemma-2-9b' | 'gemma-2-27b'
      maxTokens?: number
      deployment?: 'azure-ml' | 'huggingface' | 'self-hosted' | 'vertex-ai'
      config?: {
        temperature?: number
        topP?: number
        topK?: number
      }
    }
  }
  routing: {
    costOptimization: boolean
    preferredProvider: AIProvider
    fallbackProviders: AIProvider[]
  }
}

export interface VideoAnalysisRequest {
  mediaUrl: string
  mediaType: 'video' | 'image'
  analysisType: 'venue-extraction' | 'product-identification' | 'scene-analysis' | 'caption-generation'
  context?: {
    location?: string
    hashtags?: string[]
    description?: string
  }
}

export interface VideoIntelligenceResult {
  scenes?: Array<{
    startTime: number
    endTime: number
    description: string
    confidence: number
  }>
  objects?: Array<{
    name: string
    confidence: number
    boundingBox?: {
      x: number
      y: number
      width: number
      height: number
    }
    timespan?: {
      start: number
      end: number
    }
  }>
  faces?: Array<{
    confidence: number
    attributes?: Record<string, any>
    timespan?: {
      start: number
      end: number
    }
  }>
  transcription?: {
    text: string
    confidence: number
    language?: string
  }
  insights?: {
    brands?: string[]
    locations?: string[]
    topics?: string[]
  }
}

export interface AIAnalysisResult {
  provider: AIProvider
  processingTime: number
  cost?: {
    tokens: number
    estimatedCost: number
    currency: 'USD'
  }
  confidence: number
  
  // Video-specific results
  videoAnalysis?: VideoIntelligenceResult
  
  // Extracted business information
  venues?: Array<{
    name: string
    type: string
    location?: string
    confidence: number
    evidence: string[]
  }>
  
  products?: Array<{
    name: string
    category: string
    brand?: string
    confidence: number
    evidence: string[]
  }>
  
  // Text analysis results
  textAnalysis?: {
    summary: string
    sentiment: 'positive' | 'negative' | 'neutral'
    keywords: string[]
    entities: Array<{
      name: string
      type: string
      confidence: number
    }>
  }
  
  // Raw response for debugging
  rawResponse?: any
  errors?: string[]
}

export interface AIJob {
  id: string
  request: VideoAnalysisRequest
  priority: 'high' | 'medium' | 'low'
  createdAt: Date
  attempts: number
  maxAttempts: number
}

export interface ProcessingMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageProcessingTime: number
  totalCost: number
  providerUsage: Record<AIProvider, number>
}
