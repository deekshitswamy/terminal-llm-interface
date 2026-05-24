import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(SOURCE_DIR, "..", "scripts");

function runScript(scriptName) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);

  return new Promise((resolve, reject) => {
    const child = spawn("bash", [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `${scriptName} failed.`));
    });
  });
}

export function setupChatgptGateway() {
  return runScript("setup-chatgpt-browser.sh");
}

export function startChatgptGateway() {
  return runScript("start-chatgpt-browser.sh");
}

export function stopChatgptGateway() {
  return runScript("stop-chatgpt-browser.sh");
}

export function openChatgptGatewayLogin() {
  return runScript("open-chatgpt-browser-login.sh");
}
