/**
 * AI Service Types
 * Simple types for Gemma 3 AI model deployment
 */

export interface GemmaModelConfig {
  // Azure Container Instance configuration
  azure: {
    endpoint: string     // Container URL (e.g., http://gemma-social-crawl.eastus.azurecontainer.io:8080)
    apiKey?: string      // Optional authentication
  }
  
  // Basic model settings
  model: {
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
}

export interface AIAnalysisResult {
  success: boolean
  text: string
  processingTime: number
  error?: string
}
