import { GoogleGenAI } from '@google/genai'
import { logger } from '../../shared/logger';

export async function handleSearchRequest(message: any): Promise<any> {
  const apiKey = process.env["gemini-api-key"];
  if (!apiKey) {
    throw new Error("gemini-api-key is not set in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });
  const userPrompt = message?.payload?.prompt || "";
  let text = '';
  try {
    logger.debug('[handleSearchRequest] Prompt:', { userPrompt });
    const tools = [
      { googleSearch: {} }
    ];
    const config = {
      temperature: 0.15,
      thinkingConfig: {
        thinkingBudget: 0,
      },
      tools,
    };
    const contents = [
      {
        role: 'user',
        parts: [
          { text: userPrompt },
        ],
      },
    ];
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config,
      contents,
    });
    text = result.text || '';
  } catch (err) {
    logger.error('[handleSearchRequest] GenAI API Error:', err instanceof Error ? err : new Error(String(err)));
  }
  return text;
}
