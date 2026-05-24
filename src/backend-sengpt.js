import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { BRIDGE_PATH, SENGPT_PYTHON } from "./paths.js";

function parseBridgeOutput(rawLine) {
  const line = rawLine.trim();
  if (!line) {
    return null;
  }

  try {
    return JSON.parse(line);
  } catch {
    return { type: "stderr", content: line };
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolvePythonPath(config) {
  if (config.sengpt.pythonPath) {
    return config.sengpt.pythonPath;
  }

  if (await exists(SENGPT_PYTHON)) {
    return SENGPT_PYTHON;
  }

  return "python3.11";
}

export async function getSengptStatus(config) {
  const pythonPath = await resolvePythonPath(config);
  const hasToken = Boolean(
    config.sengpt.sessionToken ||
      (config.sengpt.sessionTokenChunk0 && config.sengpt.sessionTokenChunk1) ||
      process.env.SENGPT_SESSION_TOKEN
  );
  return {
    pythonPath,
    hasToken
  };
}

export async function doctorBackend(config) {
  const pythonPath = await resolvePythonPath(config);

  return new Promise((resolve) => {
    const child = spawn(
      pythonPath,
      [BRIDGE_PATH],
      {
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.once("close", (code) => {
      const payload = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseBridgeOutput)
        .find((event) => event?.type === "doctor");

      resolve({
        ok: code === 0 && payload?.ok === true,
        pythonPath,
        details: payload ?? null,
        stderr: stderr.trim()
      });
    });

    child.stdin.end(
      `${JSON.stringify({
        action: "doctor"
      })}\n`
    );
  });
}

export async function resetConversation(config, conversationId, deleteRemote = false) {
  if (!conversationId) {
    return { deleted: false };
  }

  const pythonPath = await resolvePythonPath(config);

  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [BRIDGE_PATH], {
      stdio: ["pipe", "pipe", "pipe"]
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
      const event = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseBridgeOutput)
        .find((entry) => entry?.type === "reset");

      if (code === 0) {
        resolve(event ?? { deleted: false, stderr: stderr.trim() });
        return;
      }

      reject(new Error(stderr.trim() || "Failed to reset conversation."));
    });

    child.stdin.end(
      `${JSON.stringify({
        action: "reset",
        deleteRemote,
        conversationId,
        sessionToken: config.sengpt.sessionToken || process.env.SENGPT_SESSION_TOKEN || "",
        sessionTokenChunk0: config.sengpt.sessionTokenChunk0 || "",
        sessionTokenChunk1: config.sengpt.sessionTokenChunk1 || "",
        extraCookies: config.sengpt.extraCookies || ""
      })}\n`
    );
  });
}

export async function sendMessage({
  config,
  state,
  prompt,
  onChunk
}) {
  const pythonPath = await resolvePythonPath(config);

  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [BRIDGE_PATH], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stderr = "";
    let doneEvent = null;
    let errorEvent = null;
    let buffered = "";

    child.stdout.on("data", (chunk) => {
      buffered += chunk.toString("utf8");
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseBridgeOutput(line);
        if (!event) {
          continue;
        }

        if (event.type === "chunk") {
          onChunk(event.content);
          continue;
        }

        if (event.type === "done") {
          doneEvent = event;
          continue;
        }

        if (event.type === "error") {
          errorEvent = event;
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0 || errorEvent) {
        reject(
          new Error(
            errorEvent?.message ||
              stderr.trim() ||
              "The Sengpt bridge exited unexpectedly."
          )
        );
        return;
      }

      if (!doneEvent) {
        reject(new Error("The Sengpt bridge finished without returning a response."));
        return;
      }

      resolve(doneEvent);
    });

    child.stdin.end(
      `${JSON.stringify({
        action: "chat",
        sessionToken: config.sengpt.sessionToken || process.env.SENGPT_SESSION_TOKEN || "",
        sessionTokenChunk0: config.sengpt.sessionTokenChunk0 || "",
        sessionTokenChunk1: config.sengpt.sessionTokenChunk1 || "",
        extraCookies: config.sengpt.extraCookies || "",
        prompt,
        conversationId: state.conversationId,
        model: config.sengpt.model,
        stylePrompt: config.stylePrompt,
        isNewConversation: !state.conversationId
      })}\n`
    );
  });
}
