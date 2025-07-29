// Letterbox for analyse-media jobs
import { serviceBus } from '../../shared/serviceBus';

export interface AnalyseMediaJob {
  id: string;
  workflow: any;
  blobUrl: string;
}

export const analyseMediaLetterbox = {
  type: 'analyse-media',
  queueName: process.env["ASB-ANALYSE-MEDIA-QUEUE"] || 'analyse-media',

  sendJob: async (job: AnalyseMediaJob) => {
    try {
      if (!serviceBus.isConnected()) {
        throw new Error('Service bus not connected.');
      }
      const sender = serviceBus.createQueueSender(analyseMediaLetterbox.queueName);
      await sender.sendMessages({
        body: job,
        contentType: 'application/json',
        messageId: job.id || job.blobUrl,
      });
      // Log success
      console.log('analyseMediaLetterbox: Job sent', { job });
    } catch (err) {
      console.error('analyseMediaLetterbox: Error sending job', err instanceof Error ? err : new Error(String(err)), { job });
      // Optionally: rethrow or handle error
    }
  }
};
