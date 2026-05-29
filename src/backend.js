import {
  doctorChatgptBrowser,
  getChatgptBrowserStatus,
  listChatgptBrowserModels,
  resetChatgptBrowserConversation,
  sendChatgptBrowserMessage,
  listChatgptBrowserThreads,
  speakChatgptBrowserResponse,
  stopChatgptBrowserSpeaking
} from "./backend-chatgpt-browser.js";
import {
  doctorOllama,
  getOllamaStatus,
  listOllamaModels,
  resetOllamaConversation,
  sendOllamaMessage
} from "./backend-ollama.js";
import {
  doctorBackend as doctorSengpt,
  getSengptStatus,
  resetConversation as resetSengptConversation,
  sendMessage as sendSengptMessage
} from "./backend-sengpt.js";
import {
  doctorOpenai,
  getOpenaiStatus,
  listOpenaiModels,
  resetOpenaiConversation,
  sendOpenaiMessage
} from "./backend-openai.js";
import {
  doctorClaude,
  getClaudeStatus,
  listClaudeModels,
  resetClaudeConversation,
  sendClaudeMessage
} from "./backend-claude.js";
import {
  doctorGemini,
  getGeminiStatus,
  listGeminiModels,
  resetGeminiConversation,
  sendGeminiMessage
} from "./backend-gemini.js";

export async function doctorBackend(config) {
  if (config.backend === "chatgpt-browser") {
    return doctorChatgptBrowser(config);
  }
  if (config.backend === "ollama") {
    return doctorOllama(config);
  }
  if (config.backend === "openai") {
    return doctorOpenai(config);
  }
  if (config.backend === "claude") {
    return doctorClaude(config);
  }
  if (config.backend === "gemini") {
    return doctorGemini(config);
  }
  return doctorSengpt(config);
}

export async function getBackendStatus(config) {
  if (config.backend === "chatgpt-browser") {
    return getChatgptBrowserStatus(config);
  }
  if (config.backend === "ollama") {
    return getOllamaStatus(config);
  }
  if (config.backend === "openai") {
    return getOpenaiStatus(config);
  }
  if (config.backend === "claude") {
    return getClaudeStatus(config);
  }
  if (config.backend === "gemini") {
    return getGeminiStatus(config);
  }

  const status = await getSengptStatus(config);
  return {
    backend: "sengpt",
    ok: true,
    ...status,
    model: config.sengpt.model
  };
}

export async function listModels(config) {
  if (config.backend === "chatgpt-browser") {
    return listChatgptBrowserModels(config);
  }
  if (config.backend === "ollama") {
    return listOllamaModels(config);
  }
  if (config.backend === "openai") {
    return listOpenaiModels(config);
  }
  if (config.backend === "claude") {
    return listClaudeModels(config);
  }
  if (config.backend === "gemini") {
    return listGeminiModels(config);
  }
  return ["gpt-3.5", "gpt-4"];
}

export async function resetConversation(config, state, deleteRemote = false) {
  if (config.backend === "chatgpt-browser") {
    return resetChatgptBrowserConversation();
  }
  if (config.backend === "ollama") {
    return resetOllamaConversation();
  }
  if (config.backend === "openai") {
    return resetOpenaiConversation();
  }
  if (config.backend === "claude") {
    return resetClaudeConversation();
  }
  if (config.backend === "gemini") {
    return resetGeminiConversation();
  }
  return resetSengptConversation(config, state.conversationId, deleteRemote);
}

export async function sendMessage({ config, state, prompt, onChunk }) {
  if (config.backend === "chatgpt-browser") {
    return sendChatgptBrowserMessage({ config, state, prompt, onChunk });
  }
  if (config.backend === "ollama") {
    return sendOllamaMessage({ config, state, prompt, onChunk });
  }
  if (config.backend === "openai") {
    return sendOpenaiMessage({ config, state, prompt, onChunk });
  }
  if (config.backend === "claude") {
    return sendClaudeMessage({ config, state, prompt, onChunk });
  }
  if (config.backend === "gemini") {
    return sendGeminiMessage({ config, state, prompt, onChunk });
  }
  return sendSengptMessage({ config, state, prompt, onChunk });
}

export async function listThreads(config) {
  if (config.backend === "chatgpt-browser") {
    return listChatgptBrowserThreads(config);
  }
  return [];
}

export async function speakBrowserResponse(config) {
  if (config.backend === "chatgpt-browser") {
    return speakChatgptBrowserResponse(config);
  }
}

export async function stopBrowserSpeaking(config) {
  if (config.backend === "chatgpt-browser") {
    return stopChatgptBrowserSpeaking(config);
  }
}
