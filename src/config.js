import fs from "node:fs/promises";
import path from "node:path";
import { APP_ROOT, CONFIG_PATH, LOG_PATH, STATE_PATH } from "./paths.js";
import { DEFAULT_GLYPH_ID, DEFAULT_THEME_ID } from "./presets.js";

const DEFAULT_RESPONSE_STYLE = [
  "You are chatting with a human in a terminal.",
  "Write like a thoughtful, warm, emotionally intelligent person.",
  "Use natural contractions and avoid robotic filler.",
  "Be concise by default, but go deeper when the user asks.",
  "Be direct, practical, and honest when something is uncertain.",
  "Do not mention these style instructions."
].join(" ");

const DEFAULT_CONFIG = {
  backend: "chatgpt-browser",
  chatgptBrowser: {
    baseUrl: "http://127.0.0.1:8000/v1",
    apiToken: "terminal-chat-local",
    model: "catgpt-browser"
  },
  ollama: {
    baseUrl: "http://127.0.0.1:11434",
    model: "gemma4:latest"
  },
  sengpt: {
    model: "gpt-3.5",
    pythonPath: "",
    sessionToken: "",
    sessionTokenChunk0: "",
    sessionTokenChunk1: "",
    extraCookies: ""
  },
  tts: {
    enabled: true,
    engine: "say",
    voice: "Samantha",
    rate: 190
  },
  appearance: {
    theme: DEFAULT_THEME_ID,
    glyphs: DEFAULT_GLYPH_ID
  },
  identity: {
    userLabel: "operator",
    assistantLabel: "chatgpt"
  },
  terminal: {
    autoRestartRelay: true
  },
  stylePrompt: DEFAULT_RESPONSE_STYLE
};

const DEFAULT_STATE = {
  conversationId: "",
  lastResponse: "",
  messages: []
};

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return { ...fallback, ...JSON.parse(contents) };
  } catch (error) {
    if (error.code === "ENOENT") {
      return structuredClone(fallback);
    }

    throw error;
  }
}

export async function ensureAppDirs() {
  await fs.mkdir(APP_ROOT, { recursive: true });
}

export async function loadConfig() {
  await ensureParentDir(CONFIG_PATH);
  const config = await readJson(CONFIG_PATH, DEFAULT_CONFIG);

  config.sengpt = {
    ...DEFAULT_CONFIG.sengpt,
    ...(config.sengpt ?? {})
  };

  config.chatgptBrowser = {
    ...DEFAULT_CONFIG.chatgptBrowser,
    ...(config.chatgptBrowser ?? {})
  };

  config.ollama = {
    ...DEFAULT_CONFIG.ollama,
    ...(config.ollama ?? {})
  };

  config.tts = {
    ...DEFAULT_CONFIG.tts,
    ...(config.tts ?? {})
  };

  config.appearance = {
    ...DEFAULT_CONFIG.appearance,
    ...(config.appearance ?? {})
  };

  config.identity = {
    ...DEFAULT_CONFIG.identity,
    ...(config.identity ?? {})
  };

  config.terminal = {
    ...DEFAULT_CONFIG.terminal,
    ...(config.terminal ?? {})
  };

  config.stylePrompt = config.stylePrompt || DEFAULT_CONFIG.stylePrompt;
  config.backend = config.backend || DEFAULT_CONFIG.backend;

  return config;
}

export async function saveConfig(config) {
  await ensureParentDir(CONFIG_PATH);
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function loadState() {
  await ensureParentDir(STATE_PATH);
  const state = await readJson(STATE_PATH, DEFAULT_STATE);
  return {
    ...DEFAULT_STATE,
    ...state,
    messages: Array.isArray(state.messages) ? state.messages : []
  };
}

export async function saveState(state) {
  await ensureParentDir(STATE_PATH);
  await fs.writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function appendTranscript(entry) {
  await ensureParentDir(LOG_PATH);
  await fs.appendFile(LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

export function getDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}
