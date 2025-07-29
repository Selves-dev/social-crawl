import { logger } from '../../shared/logger';

export function buildAnalysisPrompt(blobJson: any, workflow: any): string {
  // Example: Build a prompt for AI based on blobJson and workflow
  logger.info('Building analysis prompt', { blobJson, workflow });
  // Customize this template as needed for your AI use case
  return `Analyse the following media and workflow:
Workflow: ${JSON.stringify(workflow, null, 2)}
Media: ${JSON.stringify(blobJson.media, null, 2)}
`;
}
