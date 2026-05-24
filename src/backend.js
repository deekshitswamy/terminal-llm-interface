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

export async function doctorBackend(config) {
  if (config.backend === "chatgpt-browser") {
    return doctorChatgptBrowser(config);
  }

  if (config.backend === "ollama") {
    return doctorOllama(config);
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

  return ["gpt-3.5", "gpt-4"];
}

export async function resetConversation(config, state, deleteRemote = false) {
  if (config.backend === "chatgpt-browser") {
    return resetChatgptBrowserConversation();
  }

  if (config.backend === "ollama") {
    return resetOllamaConversation();
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
