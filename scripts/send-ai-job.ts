// Script to enqueue a direct AI job to the ai-service queue for testing
import { aiServiceQueue } from '../src/utils/ai-service'
import { getServiceBusConfigFromEnv, serviceBus } from '../src/utils/shared/serviceBus'

async function main() {
  // Connect to Service Bus if not already connected
  if (!serviceBus.isConnected()) {
    const config = getServiceBusConfigFromEnv()
    await serviceBus.connect(config)
  }
  await aiServiceQueue.initialize()

  // Example AI job message
  const job = {
    id: `ai_test_${Date.now()}`,
    type: 'generic_ai' as const,
    inputData: {
      modelType: 'text',
      prompt: 'Where in the world shall we go next?',
      workflow: { batchId: 'batch_test_001', stage: 'FIND_LOCATION' },
      responseHandler: { type: 'find-location', config: {} },
      options: { maxTokens: 64 }
    },
    parameters: { maxTokens: 64 },
    timestamp: new Date().toISOString()
  }

  await aiServiceQueue.sendJob(job)
  console.log('✅ AI job sent to ai-service queue')
}

main().catch(err => {
  console.error('Failed to send AI job:', err)
  process.exit(1)
})
