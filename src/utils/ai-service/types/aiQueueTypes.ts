import { WorkflowContext } from '../shared/workflowTracker'

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
