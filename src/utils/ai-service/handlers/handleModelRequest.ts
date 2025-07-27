import { logger } from '../../shared/logger'
import fetch from 'node-fetch'
import type { AIQueueMessage } from '../types/aiQueueTypes'

/**
 * Handler for text-only model requests (Azure GPT)
 * Extend this to support other model types as needed.
 */
export async function handleTextModel(msg: AIQueueMessage): Promise<any> {
  logger.info('handleTextModel called', { prompt: msg.prompt })

  // Gather Azure OpenAI config from env
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION
  const temperature = parseFloat(process.env.AZURE_OPENAI_TEMPERATURE || '0.25')
  if (!endpoint || !deployment || !apiKey || !apiVersion) {
    logger.error('Missing Azure OpenAI config: ' + JSON.stringify({ endpoint, deployment, apiKey: !!apiKey, apiVersion }))
    throw new Error('Azure OpenAI config missing')
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
  const body = {
    messages: [
      { role: 'user', content: msg.prompt }
    ],
    temperature,
    max_tokens: msg.options?.maxTokens || 256
  }
  logger.info('Calling Azure OpenAI', { url, body })
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(body)
  })
  const data = await response.json()
  logger.info('Azure OpenAI response', { data })
  const text = data.choices?.[0]?.message?.content || ''
  return {
    text,
    model: deployment,
    success: !!text,
    raw: data
  }
}

// Stubs for future handlers
export async function handleTextImageModel(msg: AIQueueMessage): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return { text: 'Simulated multimodal (text+image) response', model: 'azure-gpt-multimodal', success: true }
}

export async function handleTextAudioModel(msg: AIQueueMessage): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return { text: 'Simulated multimodal (text+audio) response', model: 'azure-gpt-multimodal', success: true }
}
