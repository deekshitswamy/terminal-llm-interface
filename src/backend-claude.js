/**
 * Claude (Anthropic) API Backend Scaffold
 * 
 * To wire this up fully:
 * 1. Implement Anthropic chat completion endpoint using standard fetch to:
 *    https://api.anthropic.com/v1/messages
 * 2. Send headers:
 *    - x-api-key: config.claude.apiKey
 *    - anthropic-version: "2023-06-01"
 *    - content-type: "application/json"
 * 3. Handle the JSON-Lines or Server-Sent Events (SSE) streaming format
 *    for typewriter rendering (similar to backend-openai.js).
 */

export async function doctorClaude(config) {
  if (!config.claude.apiKey) {
    return { ok: false, details: { message: "Claude API key is missing. Set it in config." } };
  }
  // Scaffold: Return healthy/ok for now
  return { ok: true, details: { message: "Claude backend scaffold is active." } };
}

export async function getClaudeStatus(config) {
  const doctor = await doctorClaude(config);
  return {
    backend: "claude",
    ok: doctor.ok,
    model: config.claude.model,
    baseUrl: config.claude.baseUrl
  };
}

export async function listClaudeModels() {
  return ["claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"];
}

export async function resetClaudeConversation() {
  return { deleted: false };
}

export async function sendClaudeMessage({ config, state, prompt, onChunk }) {
  const apiKey = config.claude.apiKey;
  if (!apiKey) {
    throw new Error("Claude API key is not configured. Edit your config.json.");
  }

  // TODO: Implement actual API fetch call.
  // Below is a mock simulation showing typewriter effect on the scaffold response:
  const mockResponse = `This is a scaffold response from your Claude backend client! 
  
To fully activate this, implement the fetch API inside src/backend-claude.js using your Anthropic long-lived token.`;
  
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
