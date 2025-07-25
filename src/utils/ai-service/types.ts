/**
 * AI Service Types
 * Simple types for Gemma 3n AI model deployment (latest efficient model)
 */

export interface GemmaModelConfig {
  // Azure Container Instance configuration
  azure: {
    endpoint: string     // Container URL (e.g., http://gemma-social-crawl.eastus.azurecontainer.io:8080)
    apiKey?: string      // Optional authentication
  }
  
  // Gemma 3n model settings
  model: {
    size: 'gemma-3n-E2B-it' | 'gemma-3n-E4B-it'  // E2B (effective 2B) or E4B (effective 4B)
    maxTokens: number
    temperature: number
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
  // Multimodal support (future)
  imageUrl?: string
  audioData?: string
}

export interface AIAnalysisResult {
  success: boolean
  text: string
  processingTime: number
  error?: string
}
