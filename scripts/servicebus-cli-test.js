// Azure Service Bus CLI Test Script
// Usage: node servicebus-cli-test.js
// Requires: npm install @azure/service-bus

require('dotenv').config({ path: '.env.local' });
const { ServiceBusClient } = require('@azure/service-bus');

const connectionString = process.env['ASB_CONNECTION_STRING'];
const queueName = process.env['asb-post-office-queue'] || 'post-office';

if (!connectionString) {
  console.error('Missing ASB_CONNECTION_STRING in .env.local');
  process.exit(1);
}

async function sendTestMessage() {
  const sbClient = new ServiceBusClient(connectionString);
  const sender = sbClient.createSender(queueName);
  const message = {
    body: {
      util: 'cli-test',
      type: 'test-message',
      workflow: { batchId: 'cli-test', stage: 'cli', timestamp: new Date().toISOString() },
      payload: { hello: 'from CLI' }
    },
    contentType: 'application/json',
    messageId: `cli-test-${Date.now()}`
  };
  await sender.sendMessages(message);
  console.log('Message sent:', message.messageId);
  await sender.close();
  await sbClient.close();
}

async function receiveTestMessages() {
  const sbClient = new ServiceBusClient(connectionString);
  const receiver = sbClient.createReceiver(queueName);
  console.log('Waiting for messages... (Ctrl+C to exit)');
  receiver.subscribe({
    processMessage: async (msg) => {
      console.log('Received message:', msg.messageId);
      console.log('Body:', msg.body);
      await receiver.completeMessage(msg);
    },
    processError: async (err) => {
      console.error('Error:', err);
    }
  }, {
    maxConcurrentCalls: 2,
    autoCompleteMessages: false
  });
  // Keep process alive
  await new Promise(() => {});
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'send') {
    await sendTestMessage();
  } else if (mode === 'receive') {
    await receiveTestMessages();
  } else {
    console.log('Usage: node servicebus-cli-test.js [send|receive]');
    console.log('Set ASB_CONNECTION_STRING and asb-post-office-queue in .env.local');
  }
}

main();
