// Script to enqueue a find-location message to the postman queue
import { serviceBus, sendPostmanMessage } from '../src/utils/shared/serviceBus'
import { getServiceBusConfigFromEnv } from '../src/utils/shared/serviceBus'

async function main() {
  // Connect to Service Bus if not already connected
  if (!serviceBus.isConnected()) {
    const config = getServiceBusConfigFromEnv()
    await serviceBus.connect(config)
  }

  // Example workflow context
  const context = {
    batchId: 'batch_test_001',
    stage: 'FIND_LOCATION',
    locationId: 'test_location',
    locationName: 'Test Location',
    // Add any other required WorkflowContext fields here
  }

  // Send the find-location message
  await sendPostmanMessage({
    type: 'find-location',
    context,
    payload: {}
  })

  console.log('✅ find-location message sent to postman queue')
}

main().catch(err => {
  console.error('Failed to send find-location message:', err)
  process.exit(1)
})
