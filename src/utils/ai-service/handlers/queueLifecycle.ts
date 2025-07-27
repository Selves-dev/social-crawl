import { QueueManager } from '../../shared/queueManager'

/**
 * Ensures the AI service queue is started before enqueueing a request.
 */
export async function ensureAIServiceQueueRunning() {
  await QueueManager.startAIServiceProcessing()
}

/**
 * Attempts to stop the AI service queue if it is empty, with a small delay to avoid rapid cycling.
 * You should call this after processing a job.
 */
export async function shutdownAIServiceQueueIfIdle(checkIsEmpty: () => Promise<boolean>, delayMs = 2000) {
  setTimeout(async () => {
    if (await checkIsEmpty()) {
      await QueueManager.stopAIServiceProcessing()
    }
  }, delayMs)
}
