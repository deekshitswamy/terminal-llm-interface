/**
 * Gemini (Google) API Backend Scaffold
 * 
 * To wire this up fully:
 * 1. Implement Gemini completions endpoint using standard fetch to:
 *    https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={apiKey}
 * 2. Send body:
 *    {
 *      "contents": [
 *        {
 *          "parts": [{"text": prompt}]
 *        }
 *      ]
 *    }
 * 3. Handle chunk stream parse for real-time typewriter output.
 */

export async function doctorGemini(config) {
  if (!config.gemini.apiKey) {
    return { ok: false, details: { message: "Gemini API key is missing. Set it in config." } };
  }
  return { ok: true, details: { message: "Gemini backend scaffold is active." } };
}

export async function getGeminiStatus(config) {
  const doctor = await doctorGemini(config);
  return {
    backend: "gemini",
    ok: doctor.ok,
    model: config.gemini.model,
    baseUrl: config.gemini.baseUrl
  };
}

export async function listGeminiModels() {
  return ["gemini-1.5-pro", "gemini-1.5-flash"];
}

export async function resetGeminiConversation() {
  return { deleted: false };
}

export async function sendGeminiMessage({ config, state, prompt, onChunk }) {
  const apiKey = config.gemini.apiKey;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Edit your config.json.");
  }

  // TODO: Implement actual API fetch call.
  const mockResponse = `This is a scaffold response from your Gemini backend client! 
  
To fully activate this, implement the fetch API inside src/backend-gemini.js using your Google Gemini developer key.`;
  
  const chunkSize = 5;
  for (let i = 0; i < mockResponse.length; i += chunkSize) {
    onChunk(mockResponse.slice(i, i + chunkSize));
    await new Promise(r => setTimeout(r, 10));
  }

  return {
    response: mockResponse,
    messages: [
      ...state.messages,
      { role: "user", content: prompt },
      { role: "assistant", content: mockResponse }
    ]
  };
}
