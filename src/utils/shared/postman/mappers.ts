
// Example stub: Replace with real handlers as needed
import { buildLocationPrompt, handleLocationResponse } from '../../find-location/handlers/handleFindLocation'
import { sendPostmanMessage } from '../serviceBus'
import type { WorkflowContext } from '../workflowTracker'

export const postmanMappers: Record<string, (payload: any, context: WorkflowContext) => Promise<void>> = {
  'find-location': async (payload, context) => {
    // If this is an AI response, handle and log it
    if (payload && payload.text) {
      await handleLocationResponse(payload, context)
      return
    }
    // Otherwise, build the prompt and enqueue the AI job
    const prompt = buildLocationPrompt()
    await sendPostmanMessage({
      type: 'ai_request',
      context,
      payload: {
        modelType: 'text',
        prompt,
        responseHandler: payload?.responseHandler || { type: 'find-location', config: {} },
        options: payload?.options || { maxTokens: 64 },
        meta: payload?.meta
      }
    })
  }
}
