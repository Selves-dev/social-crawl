/**
 * Workflow Tracking and Database Utilities
 * Combines workflow context management and MongoDB persistence for the social crawl workflow
 */

import { db } from '../shared/database'
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
  itemId?: string             // Individual video/media item ID
  itemUrl?: string            // Source URL of the media
  itemType?: 'video' | 'image' | 'post'
  completedStages: WorkflowStage[]
  metadata: {
    inputQueries?: string[]        // User-provided queries at workflow start
    generatedQueries?: string[]    // Generated search queries (from control stage)
    mediaInfo?: any               // Media metadata (from prep-media)
    analysisResults?: any         // AI analysis results (from analyse-media)
    enrichmentData?: any          // Final enriched data (from enrich-venue)
    [key: string]: any            // Extensible for other data
  }
  errors?: Array<{
    stage: WorkflowStage
    error: string
    timestamp: string
  }>
}

// Document interfaces for DB
export interface LocationDocument {
  _id?: string
  locationId: string
  locationName?: string
  countryCode?: string
  createdAt: Date
  updatedAt: Date
  metadata: {
    queries?: string[]
    coordinates?: {
      lat: number
      lng: number
    }
  }
}

export interface MediaDocument {
  _id?: string
  itemId: string
  itemUrl: string
  itemType: 'video' | 'image' | 'post'
  locationId: string
  batchId: string
  processedAt?: Date
  metadata: {
    duration?: number
    size?: number
    analysisResults?: any
  }
}

export interface WorkflowDocument {
  _id?: string
  batchId: string
  locationId: string
  status: 'active' | 'completed' | 'failed'
  currentStage: string
  createdAt: Date
  updatedAt: Date
  context: WorkflowContext
}

/**
 * Workflow context management utilities
 */
export class WorkflowTracker {
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
        inputQueries: queries
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

  static createItemContext(batchContext: WorkflowContext, itemId: string, itemUrl: string, itemType: 'video' | 'image' | 'post'): WorkflowContext {
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
      itemUrl: itemUrl.substring(0, 100),
      itemType,
      stage: WorkflowStage.PREP_MEDIA
    })
    return itemContext
  }

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
    const parts = batchId.split('_')
    if (parts.length >= 3) {
      const startTime = parseInt(parts[2])
      const duration = Date.now() - startTime
      return `${Math.round(duration / 1000)}s`
    }
    return 'unknown'
  }
}

/**
 * Database operations for workflow management
 */
export class WorkflowDatabase {
  static async saveWorkflow(context: WorkflowContext): Promise<void> {
    try {
      const collection = db.getCollection<WorkflowDocument>('workflows')
      const workflow: WorkflowDocument = {
        batchId: context.batchId,
        locationId: context.locationId,
        status: context.errors?.length ? 'failed' : 'active',
        currentStage: context.stage,
        createdAt: new Date(),
        updatedAt: new Date(),
        context
      }
      await collection.replaceOne(
        { batchId: context.batchId },
        workflow,
        { upsert: true }
      )
      logger.info('📄 Workflow context saved to database', {
        service: 'workflow-db',
        batchId: context.batchId,
        stage: context.stage
      })
    } catch (error) {
      logger.error('Failed to save workflow context', error as Error, {
        service: 'workflow-db',
        batchId: context.batchId
      })
    }
  }

  static async getWorkflow(batchId: string): Promise<WorkflowContext | null> {
    try {
      const collection = db.getCollection<WorkflowDocument>('workflows')
      const workflow = await collection.findOne({ batchId })
      return workflow?.context || null
    } catch (error) {
      logger.error('Failed to get workflow context', error as Error, {
        service: 'workflow-db',
        batchId
      })
      return null
    }
  }

  static async saveLocation(context: WorkflowContext): Promise<void> {
    try {
      const collection = db.getCollection<LocationDocument>('locations')
      const location: LocationDocument = {
        locationId: context.locationId,
        locationName: context.locationName,
        countryCode: context.countryCode,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          queries: context.metadata.inputQueries
        }
      }
      await collection.replaceOne(
        { locationId: context.locationId },
        location,
        { upsert: true }
      )
      logger.info('📍 Location saved to database', {
        service: 'workflow-db',
        locationId: context.locationId
      })
    } catch (error) {
      logger.error('Failed to save location', error as Error, {
        service: 'workflow-db',
        locationId: context.locationId
      })
    }
  }

  static async saveMediaItem(context: WorkflowContext): Promise<void> {
    if (!context.itemId || !context.itemUrl) {
      return // Skip if no media item data
    }
    try {
      const collection = db.getCollection<MediaDocument>('media')
      const media: MediaDocument = {
        itemId: context.itemId,
        itemUrl: context.itemUrl,
        itemType: context.itemType || 'video',
        locationId: context.locationId,
        batchId: context.batchId,
        processedAt: new Date(),
        metadata: {
          analysisResults: context.metadata.analysisResults
        }
      }
      await collection.replaceOne(
        { itemId: context.itemId },
        media,
        { upsert: true }
      )
      logger.info('🎬 Media item saved to database', {
        service: 'workflow-db',
        itemId: context.itemId,
        itemType: context.itemType
      })
    } catch (error) {
      logger.error('Failed to save media item', error as Error, {
        service: 'workflow-db',
        itemId: context.itemId
      })
    }
  }

  static async getLocationAnalytics(locationId: string) {
    try {
      const mediaCollection = db.getCollection<MediaDocument>('media')
      const workflowCollection = db.getCollection<WorkflowDocument>('workflows')
      const [totalMedia, activeWorkflows, completedWorkflows] = await Promise.all([
        mediaCollection.countDocuments({ locationId }),
        workflowCollection.countDocuments({ locationId, status: 'active' }),
        workflowCollection.countDocuments({ locationId, status: 'completed' })
      ])
      return {
        locationId,
        totalMediaItems: totalMedia,
        activeWorkflows,
        completedWorkflows,
        generatedAt: new Date()
      }
    } catch (error) {
      logger.error('Failed to get location analytics', error as Error, {
        service: 'workflow-db',
        locationId
      })
      return null
    }
  }
}

export default WorkflowTracker
