import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getAppSupportRoot() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "terminal-chat");
  }

  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "terminal-chat");
  }

  return path.join(os.homedir(), ".config", "terminal-chat");
}

export const APP_ROOT = getAppSupportRoot();
export const CONFIG_PATH = path.join(APP_ROOT, "config.json");
export const STATE_PATH = path.join(APP_ROOT, "state.json");
export const LOG_PATH = path.join(APP_ROOT, "transcript.jsonl");
export const SENGPT_VENV = path.join(APP_ROOT, "sengpt-venv");
export const SENGPT_PYTHON = path.join(SENGPT_VENV, "bin", "python");
export const CHATGPT_GATEWAY_DIR = path.join(APP_ROOT, "catgpt-gateway");
const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const BRIDGE_PATH = path.resolve(SOURCE_DIR, "..", "scripts", "sengpt-bridge.py");
