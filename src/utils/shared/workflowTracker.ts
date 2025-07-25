/**
 * Workflow Tracking Utilities
 * Handles progress tracking through the social crawl workflow stages
 */

import { logger } from '../shared/logger'

// Workflow stages enum
export enum WorkflowStage {
  FIND_LOCATION = 'find-location',
  CONTROL = 'control',           // Query generation
  CRAWL_MEDIA = 'crawl-media',   // Video scraping
  PREP_MEDIA = 'prep-media',     // Download and prepare
  ANALYSE_MEDIA = 'analyse-media', // AI analysis
  ENRICH_VENUE = 'enrich-venue'  // Data enrichment
}

// Base workflow context that gets passed through all messages
export interface WorkflowContext {
  batchId: string              // Parent batch ID for the location
  locationId: string           // The location being processed
  locationName?: string        // Human readable location name
  countryCode?: string         // Country code (cc) for the location
  stage: WorkflowStage        // Current stage
  timestamp: string           // When this context was created/updated
  
  // Item-specific tracking (set after crawl-media stage)
  itemId?: string             // Individual video/media item ID
  itemUrl?: string            // Source URL of the media
  itemType?: 'video' | 'image' | 'post'
  
  // Stage completion tracking
  completedStages: WorkflowStage[]
  
  // Metadata that accumulates through the workflow
  metadata: {
    queries?: string[]          // Generated search queries (from control)
    mediaInfo?: any            // Media metadata (from prep-media)
    analysisResults?: any      // AI analysis results (from analyse-media)
    enrichmentData?: any       // Final enriched data (from enrich-venue)
    [key: string]: any         // Extensible for other data
  }
  
  // Error tracking
  errors?: Array<{
    stage: WorkflowStage
    error: string
    timestamp: string
  }>
}

export class WorkflowTracker {
  /**
   * Create a new workflow context for a location batch
   */
  static createBatch(locationId: string, locationName?: string, countryCode?: string, queries?: string[]): WorkflowContext {
    const batchId = this.generateBatchId(locationId)
    
    const context: WorkflowContext = {
      batchId,
      locationId,
      locationName,
      countryCode,
      stage: WorkflowStage.FIND_LOCATION,
      timestamp: new Date().toISOString(),
      completedStages: [],
      metadata: {
        queries // Store queries in metadata for later use
      }
    }

    logger.info(`🚀 Workflow batch created for location: ${locationName || locationId}`, {
      service: 'workflow-tracker',
      batchId,
      locationId,
      countryCode,
      stage: WorkflowStage.FIND_LOCATION,
      queryCount: queries?.length || 0
    })

    return context
  }

  /**
   * Create context for an individual item (after crawl-media stage)
   */
  static createItemContext(
    batchContext: WorkflowContext, 
    itemId: string, 
    itemUrl: string, 
    itemType: 'video' | 'image' | 'post'
  ): WorkflowContext {
    const itemContext: WorkflowContext = {
      ...batchContext,
      itemId,
      itemUrl,
      itemType,
      stage: WorkflowStage.PREP_MEDIA,
      timestamp: new Date().toISOString(),
      completedStages: [...batchContext.completedStages, WorkflowStage.CRAWL_MEDIA],
      metadata: { ...batchContext.metadata }
    }

    logger.info(`📱 Item context created: ${itemType} ${itemId}`, {
      service: 'workflow-tracker',
      batchId: batchContext.batchId,
      itemId,
      itemUrl: itemUrl.substring(0, 100), // Truncate URL for logging
      itemType,
      stage: WorkflowStage.PREP_MEDIA
    })

    return itemContext
  }

  /**
   * Progress context to next stage
   */
  static progressToStage(context: WorkflowContext, stage: WorkflowStage, metadata?: any): WorkflowContext {
    const updatedContext: WorkflowContext = {
      ...context,
      stage,
      timestamp: new Date().toISOString(),
      completedStages: context.completedStages.includes(context.stage) 
        ? context.completedStages 
        : [...context.completedStages, context.stage],
      metadata: metadata ? { ...context.metadata, ...metadata } : context.metadata
    }

    const logContext = {
      service: 'workflow-tracker',
      batchId: context.batchId,
      stage,
      ...(context.itemId && { itemId: context.itemId }),
      completedStages: updatedContext.completedStages.length,
      totalStages: Object.keys(WorkflowStage).length
    }

    logger.info(`➡️ Workflow progressed to ${stage}`, logContext)

    return updatedContext
  }

  /**
   * Mark stage as completed with results
   */
  static completeStage(context: WorkflowContext, results?: any): WorkflowContext {
    const updatedContext: WorkflowContext = {
      ...context,
      timestamp: new Date().toISOString(),
      completedStages: context.completedStages.includes(context.stage) 
        ? context.completedStages 
        : [...context.completedStages, context.stage],
      metadata: results ? { ...context.metadata, ...results } : context.metadata
    }

    const logContext = {
      service: 'workflow-tracker',
      batchId: context.batchId,
      stage: context.stage,
      ...(context.itemId && { itemId: context.itemId }),
      completedStages: updatedContext.completedStages.length,
      totalStages: Object.keys(WorkflowStage).length
    }

    logger.info(`✅ Stage completed: ${context.stage}`, logContext)

    // Check if workflow is complete
    if (updatedContext.completedStages.length === Object.keys(WorkflowStage).length) {
      logger.info(`🎉 Workflow complete for ${context.itemId ? 'item' : 'batch'}`, {
        service: 'workflow-tracker',
        batchId: context.batchId,
        ...(context.itemId && { itemId: context.itemId }),
        duration: this.calculateDuration(context.batchId)
      })
    }

    return updatedContext
  }

  /**
   * Log error in workflow stage
   */
  static logError(context: WorkflowContext, error: Error | string): WorkflowContext {
    const errorMsg = error instanceof Error ? error.message : error
    
    const updatedContext: WorkflowContext = {
      ...context,
      timestamp: new Date().toISOString(),
      errors: [
        ...(context.errors || []),
        {
          stage: context.stage,
          error: errorMsg,
          timestamp: new Date().toISOString()
        }
      ]
    }

    logger.error(`❌ Workflow error in ${context.stage}`, error instanceof Error ? error : new Error(errorMsg), {
      service: 'workflow-tracker',
      batchId: context.batchId,
      stage: context.stage,
      ...(context.itemId && { itemId: context.itemId })
    })

    return updatedContext
  }

  /**
   * Get workflow progress summary
   */
  static getProgress(context: WorkflowContext): {
    batchId: string
    itemId?: string
    currentStage: WorkflowStage
    completedStages: number
    totalStages: number
    progressPercentage: number
    hasErrors: boolean
    errorCount: number
  } {
    const totalStages = Object.keys(WorkflowStage).length
    const completedCount = context.completedStages.length
    
    return {
      batchId: context.batchId,
      itemId: context.itemId,
      currentStage: context.stage,
      completedStages: completedCount,
      totalStages,
      progressPercentage: Math.round((completedCount / totalStages) * 100),
      hasErrors: (context.errors?.length || 0) > 0,
      errorCount: context.errors?.length || 0
    }
  }

  private static generateBatchId(locationId: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `batch_${locationId}_${timestamp}_${random}`
  }

  private static calculateDuration(batchId: string): string {
    // Extract timestamp from batch ID for duration calculation
    const parts = batchId.split('_')
    if (parts.length >= 3) {
      const startTime = parseInt(parts[2])
      const duration = Date.now() - startTime
      return `${Math.round(duration / 1000)}s`
    }
    return 'unknown'
  }
}

// Export types and utilities
export { WorkflowTracker as default }
