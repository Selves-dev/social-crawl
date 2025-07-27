/**
 * AI Service Utilities
 * Handles AI-related operations and integrations
 */

export * from './throttleQueue'
// export * from './gemmaClient' // (Gemma support removed)
export * from './types'

// AI service utilities (Gemma integration removed)
export const aiServiceUtils = {
  // Re-export for convenience
  // createGemmaClient: () => import('./gemmaClient').then(m => m.createGemmaClientFromEnv())
}
