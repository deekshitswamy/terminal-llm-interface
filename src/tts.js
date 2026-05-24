import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { speakBrowserResponse, stopBrowserSpeaking } from "./backend.js";

let activeSpeechProcess = null;

function spawnPromise(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

export async function listVoices() {
  return new Promise((resolve, reject) => {
    const child = spawn("say", ["-v", "?"], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString("utf8");
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || `say exited with code ${code}`));
        return;
      }

      const voices = output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(/\s{2,}/u)[0]);

      resolve(voices);
    });
  });
}

export async function stopSpeaking(config) {
  if (config && config.tts && config.tts.engine === "browser") {
    try {
      await stopBrowserSpeaking(config);
    } catch {
      // Ignore
    }
  }

  if (activeSpeechProcess && !activeSpeechProcess.killed) {
    activeSpeechProcess.kill("SIGTERM");
  }

  activeSpeechProcess = null;
}

export async function speakText(text, settings, config) {
  if (!text.trim()) {
    return;
  }

  if (settings.engine === "browser") {
    await stopSpeaking(config);
    try {
      await speakBrowserResponse(config);
    } catch (error) {
      console.error(`Browser speech failed: ${error.message}`);
    }
    return;
  }

  if (settings.engine !== "say") {
    return;
  }

  await stopSpeaking(config);

  const tempFile = path.join(
    os.tmpdir(),
    `terminal-chat-tts-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`
  );

  await fs.writeFile(tempFile, text, "utf8");

  await new Promise((resolve, reject) => {
    const args = [
      "-v",
      settings.voice,
      "-r",
      String(settings.rate),
      "-f",
      tempFile
    ];

    const child = spawn("say", args, { stdio: "ignore" });
    activeSpeechProcess = child;

    child.once("error", reject);
    child.once("close", async (code) => {
      activeSpeechProcess = null;
      await fs.rm(tempFile, { force: true });

      if (code === 0 || code === null) {
        resolve();
        return;
      }

      reject(new Error(`say exited with code ${code}`));
    });
  });
}

export async function canUseLocalTts() {
  try {
    await spawnPromise("say", ["-v", "?"]);
    return true;
  } catch {
    return false;
  }
}
