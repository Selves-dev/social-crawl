/**
 * Database Examples and Utilities
 * Demonstrates how to use MongoDB Atlas in the social crawl workflow
 */

import { db } from '../shared/database'
import { logger } from '../shared/logger'
import { WorkflowContext } from '../shared/workflowTracker'

// Example document interfaces
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
 * Database operations for workflow management
 */
export class WorkflowDatabase {
  
  /**
   * Save or update a workflow context in the database
   */
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

  /**
   * Get workflow context from database
   */
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

  /**
   * Save location information
   */
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

  /**
   * Save media item information
   */
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

  /**
   * Get analytics for a location
   */
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

export default WorkflowDatabase
