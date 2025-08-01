export async function handleSearchRequest(message: any): Promise<any> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  const userPrompt = message.prompt || "";
  const payload = {
    contents: [
      {
        parts: [ { text: userPrompt } ]
      }
    ],
    tools: [
      { google_search_retrieval: {} }
    ],
    generationConfig: {
      temperature: 0.25,
    }
  };

  let text = '';
  let data: any = null;
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    data = await response.json();
    if (data && data.candidates?.[0]?.content?.parts) {
      text = data.candidates[0].content.parts.map((p: any) => p.text).join('') || '';
    } else {
      text = '';
    }
  } catch (err) {
    // Log error but do not throw
    // eslint-disable-next-line no-console
    console.error('[Gemini API] Error:', err);
  }
  return {
    text,
    model: 'gemini-2.5-flash-lite',
    success: !!text,
    raw: data
  };
}
