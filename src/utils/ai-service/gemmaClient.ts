/**
 * Simple Azure Container Instance Gemma Client
 * Basic communication with Gemma 3 model deployed on ACI
 */

import { AIAnalysisRequest, AIAnalysisResult, GemmaModelConfig } from './types'
import { logger } from '../shared'

export class GemmaAzureClient {
  private endpoint: string
  private timeout: number
  private apiKey?: string

  constructor(config: GemmaModelConfig) {
    this.endpoint = config.azure.endpoint
    this.timeout = 30000 // 30 seconds
    this.apiKey = config.azure.apiKey

    logger.info('Gemma client initialized', {
      endpoint: this.endpoint,
      service: 'gemma-client'
    })
  }

  /**
   * Simple text generation
   */
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.endpoint}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({
          prompt: request.prompt,
          max_tokens: request.maxTokens || 150,
          temperature: request.temperature || 0.7
        }),
        signal: AbortSignal.timeout(this.timeout)
      })

      const result = await response.json()
      const processingTime = Date.now() - startTime

      if (result.success) {
        return {
          success: true,
          text: result.text,
          processingTime
        }
      } else {
        return {
          success: false,
          text: '',
          processingTime,
          error: result.error || 'Generation failed'
        }
      }

    } catch (error) {
      const processingTime = Date.now() - startTime
      
      return {
        success: false,
        text: '',
        processingTime,
        error: error instanceof Error ? error.message : 'Network error'
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * Create client from environment variables
 */
export function createGemmaClientFromEnv(): GemmaAzureClient | null {
  const endpoint = process.env.GEMMA_ENDPOINT_URL
  
  if (!endpoint) {
    logger.warn('Gemma endpoint not configured', { service: 'gemma-client' })
    return null
  }

  const config: GemmaModelConfig = {
    azure: {
      endpoint,
      apiKey: process.env.GEMMA_API_KEY
    },
    model: {
      maxTokens: parseInt(process.env.GEMMA_MAX_TOKENS || '150'),
      temperature: parseFloat(process.env.GEMMA_TEMPERATURE || '0.7')
    }
  }

  return new GemmaAzureClient(config)
}
