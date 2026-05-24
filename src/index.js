#!/usr/bin/env node

import readline from "node:readline/promises";
import * as readlineUi from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import {
  appendTranscript,
  ensureAppDirs,
  loadConfig,
  loadState,
  saveConfig,
  saveState
} from "./config.js";
import fs from "node:fs/promises";
import {
  doctorBackend,
  getBackendStatus,
  listModels,
  listThreads,
  resetConversation,
  sendMessage
} from "./backend.js";
import {
  openChatgptGatewayLogin,
  setupChatgptGateway,
  startChatgptGateway,
  stopChatgptGateway
} from "./gateway-control.js";
import { promptSecret } from "./secret-prompt.js";
import { canUseLocalTts, listVoices, speakText, stopSpeaking } from "./tts.js";
import { listGlyphOptions, listThemeOptions } from "./presets.js";
import {
  printAssistantHeader,
  printBanner,
  printError,
  printHelp,
  printInfo,
  printPanel,
  printStatus,
  printSuccess,
  setUiConfig,
  startLoadingIndicator,
  printUserMessage,
  getUserPrompt,
  printWarning
} from "./ui.js";

const COMMAND_SUGGESTIONS = [
  "/help",
  "/terminal stop",
  "/terminal config",
  "/backend chatgpt-browser",
  "/backend ollama",
  "/backend sengpt",
  "/chatgpt setup",
  "/chatgpt start",
  "/chatgpt login",
  "/chatgpt stop",
  "/name me ",
  "/name bot ",
  "/name show",
  "/name reset",
  "/models",
  "/model ",
  "/login",
  "/clear",
  "/tts on",
  "/tts off",
  "/tts toggle",
  "/voice list",
  "/voice preview ",
  "/voice set ",
  "/repeat",
  "/status",
  "/quit"
];

function normalizeCommand(line) {
  const [command, ...rest] = line.trim().split(/\s+/u);
  return {
    command: command.toLowerCase(),
    args: rest
  };
}

function completeCommand(line) {
  if (!line.trimStart().startsWith("/")) {
    return [[], line];
  }

  const normalized = line.toLowerCase();
  const matches = COMMAND_SUGGESTIONS.filter((command) => command.startsWith(normalized));

  return [matches.length ? matches : COMMAND_SUGGESTIONS, line];
}

function rankCommandSuggestions(input) {
  const normalized = input.trim().toLowerCase();

  return COMMAND_SUGGESTIONS.map((command) => {
    const target = command.trim().toLowerCase();
    let score = 0;

    if (target.startsWith(normalized)) {
      score += 100;
    }

    if (target.includes(normalized)) {
      score += 40;
    }

    const inputParts = normalized.split(/\s+/u);
    const targetParts = target.split(/\s+/u);

    for (let index = 0; index < inputParts.length; index += 1) {
      if (targetParts[index]?.startsWith(inputParts[index])) {
        score += 20;
      }
    }

    score -= Math.abs(target.length - normalized.length);

    return { command, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((entry) => entry.command.trim());
}

async function promptSessionToken(rl) {
  rl.pause();

  try {
    const chunk0 = (
      await promptSecret("Paste __Secure-next-auth.session-token.0 (leave blank if you have a single token): ")
    ).trim();

    const chunk1 = (
      await promptSecret("Paste __Secure-next-auth.session-token.1 (leave blank if not present): ")
    ).trim();

    if (chunk0 && chunk1) {
      return {
        sessionToken: "",
        sessionTokenChunk0: chunk0,
        sessionTokenChunk1: chunk1
      };
    }

    if (chunk0) {
      return {
        sessionToken: chunk0,
        sessionTokenChunk0: "",
        sessionTokenChunk1: ""
      };
    }

    const singleToken = (
      await promptSecret("Paste __Secure-next-auth.session-token: ")
    ).trim();

    return {
      sessionToken: singleToken,
      sessionTokenChunk0: "",
      sessionTokenChunk1: ""
    };
  } finally {
    rl.resume();
  }
}

async function handleDoctor(config) {
  const doctor = await doctorBackend(config);
  if (doctor.ok) {
    if (config.backend === "ollama") {
      printSuccess(`Ollama is healthy with model ${config.ollama.model}.`);
    } else if (config.backend === "chatgpt-browser") {
      printSuccess(
        `ChatGPT browser gateway is healthy with model ${config.chatgptBrowser.model}.`
      );
    } else {
      printSuccess(`Bridge is healthy via ${doctor.pythonPath}.`);
    }
    return;
  }

  printError("Bridge check failed.");
  if (doctor.details?.message) {
    printError(doctor.details.message);
  }
  if (doctor.stderr) {
    printError(doctor.stderr);
  }
  process.exitCode = 1;
}

function sanitizeTag(value, fallback) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, 24);
}

async function chooseFromNumberedList(rl, title, entries, currentId) {
  printPanel(
    title,
    entries.map((entry, index) => {
      const marker = entry.id === currentId ? "*" : " ";
      return `${index + 1}. [${marker}] ${entry.name}`;
    })
  );

  const answer = (await rl.question("select > ")).trim();
  const index = Number.parseInt(answer, 10);
  if (!Number.isFinite(index) || index < 1 || index > entries.length) {
    return null;
  }

  return entries[index - 1];
}

async function chooseVoiceFromMenu(rl, config) {
  const voices = await listVoices();
  const curated = [
    "Samantha",
    "Daniel",
    "Moira",
    "Karen",
    "Tessa",
    "Nathan",
    "Ava",
    "Aaron",
    "Fiona",
    "Victoria",
    "Serena"
  ].filter((voice, index, all) => voices.includes(voice) && all.indexOf(voice) === index);

  const options = curated.length ? curated : voices.slice(0, 12);
  printPanel(
    "VOICE DECK",
    [
      `current voice: ${config.tts.voice}`,
      ...options.map((voice, index) => `${index + 1}. ${voice}`),
      "c. custom voice name",
      "l. list all installed voices",
      "x. cancel"
    ]
  );

  while (true) {
    const answer = (await rl.question("voice > ")).trim();
    if (!answer || answer.toLowerCase() === "x") {
      return null;
    }

    if (answer.toLowerCase() === "l") {
      printPanel("INSTALLED VOICES", voices.map((voice, index) => `${index + 1}. ${voice}`));
      continue;
    }

    if (answer.toLowerCase() === "c") {
      const customVoice = (await rl.question("custom voice > ")).trim();
      return customVoice || null;
    }

    const index = Number.parseInt(answer, 10);
    if (Number.isFinite(index) && index >= 1 && index <= options.length) {
      return options[index - 1];
    }

    printWarning("Choose a listed number, `c`, `l`, or `x`.");
  }
}

async function openTerminalConfig(rl, config) {
  while (true) {
    printPanel("TERMINAL CONTROL", [
      `1. Theme            ${config.appearance.theme}`,
      `2. Glyph Pack       ${config.appearance.glyphs}`,
      `3. Your Tag         ${config.identity.userLabel}`,
      `4. Bot Tag          ${config.identity.assistantLabel}`,
      `5. Voice            ${config.tts.voice}`,
      "6. Model            chatgpt-browser",
      "7. Preview Voice",
      "8. Exit"
    ]);

    const answer = (await rl.question("control > ")).trim();

    if (answer === "8" || answer.toLowerCase() === "x" || answer.toLowerCase() === "exit") {
      printSuccess("Exited terminal control.");
      return;
    }

    if (answer === "1") {
      const theme = await chooseFromNumberedList(
        rl,
        "SELECT THEME",
        listThemeOptions(),
        config.appearance.theme
      );
      if (theme) {
        config.appearance.theme = theme.id;
        setUiConfig(config);
        await saveConfig(config);
        printSuccess(`Theme set to ${theme.name}.`);
      }
      continue;
    }

    if (answer === "2") {
      const glyphs = await chooseFromNumberedList(
        rl,
        "SELECT GLYPH PACK",
        listGlyphOptions(),
        config.appearance.glyphs
      );
      if (glyphs) {
        config.appearance.glyphs = glyphs.id;
        setUiConfig(config);
        await saveConfig(config);
        printSuccess(`Glyph pack set to ${glyphs.name}.`);
      }
      continue;
    }

    if (answer === "3") {
      const value = sanitizeTag(await rl.question("your tag > "), config.identity.userLabel);
      config.identity.userLabel = value;
      await saveConfig(config);
      printSuccess(`Your tag is now ${value}.`);
      continue;
    }

    if (answer === "4") {
      const value = sanitizeTag(
        await rl.question("bot tag > "),
        config.identity.assistantLabel
      );
      config.identity.assistantLabel = value;
      await saveConfig(config);
      printSuccess(`Bot tag is now ${value}.`);
      continue;
    }

    if (answer === "5") {
      const voice = await chooseVoiceFromMenu(rl, config);
      if (voice) {
        config.tts.voice = voice;
        await saveConfig(config);
        printSuccess(`Voice set to ${voice}.`);
      }
      continue;
    }

    if (answer === "6") {
      config.backend = "chatgpt-browser";
      config.chatgptBrowser.model = "catgpt-browser";
      await saveConfig(config);
      printSuccess("Model path locked to ChatGPT browser relay for now.");
      continue;
    }

    if (answer === "7") {
      await stopSpeaking();
      void speakText("This is your current local voice preview.", config.tts).catch((error) => {
        printError(error.message);
      });
      printInfo(`Previewing ${config.tts.voice}.`);
      continue;
    }

    printWarning("Choose 1-8.");
  }
}

async function main() {
  await ensureAppDirs();
  const config = await loadConfig();
  const state = await loadState();
  setUiConfig(config);

  // Parse command line options
  const args = process.argv;
  const parsedArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--bot=")) {
      parsedArgs.bot = arg.slice(6);
    } else if (arg === "--bot") {
      parsedArgs.bot = args[i + 1];
      i++;
    } else if (arg.startsWith("--choose=")) {
      parsedArgs.choose = arg.slice(9);
    } else if (arg === "--choose") {
      parsedArgs.choose = args[i + 1];
      i++;
    } else if (arg.startsWith("--prompt=")) {
      parsedArgs.prompt = arg.slice(9);
    } else if (arg === "--prompt") {
      parsedArgs.prompt = args[i + 1];
      i++;
    }
  }

  if (process.argv.includes("--doctor")) {
    await handleDoctor(config);
    return;
  }

  if (parsedArgs.bot) {
    const requestedBot = parsedArgs.bot.toLowerCase();
    if (requestedBot === "chatgpt" || requestedBot === "chatgpt-browser") {
      config.backend = "chatgpt-browser";
    } else if (requestedBot === "ollama") {
      config.backend = "ollama";
    } else if (requestedBot === "sengpt") {
      config.backend = "sengpt";
    } else {
      printWarning(`Unknown bot "${parsedArgs.bot}". Supported bots: chatgpt, ollama, sengpt.`);
    }
    await saveConfig(config);
    setUiConfig(config);
  }

  if (parsedArgs.choose && parsedArgs.choose.startsWith("new:")) {
    state.conversationId = "";
    state.lastResponse = "";
    state.messages = [];
    await saveState(state);
  }

  if (!(await canUseLocalTts())) {
    config.tts.enabled = false;
    await saveConfig(config);
  }

  if (config.backend === "chatgpt-browser" && config.terminal.autoRestartRelay) {
    try {
      await stopChatgptGateway();
    } catch {
      // Ignore stop errors on boot; start handles the real health check.
    }

    try {
      await startChatgptGateway();
    } catch (error) {
      console.error(`ChatGPT relay auto-start failed: ${error.message}`);
    }
  }

  const rl = readline.createInterface({
    input,
    output,
    terminal: process.stdin.isTTY,
    completer: completeCommand
  });

  process.on("SIGINT", async () => {
    await stopSpeaking();
    rl.close();
    process.exit(0);
  });

  if (parsedArgs.choose) {
    const chooseVal = parsedArgs.choose;
    if (chooseVal === "from-chat-history") {
      printInfo("Fetching recent chat history...");
      try {
        const threads = await listThreads(config);
        if (threads.length === 0) {
          printWarning("No recent chat history found.");
        } else {
          printPanel(
            "CHOOSE CHAT HISTORY",
            threads.map((t, idx) => `${idx + 1}. ${t.title || "(Untitled Chat)"}`)
          );

          let selectedIdx = null;
          while (selectedIdx === null) {
            const ans = (await rl.question("select chat index (or 'x' for new) > ")).trim();
            if (ans.toLowerCase() === "x") {
              state.conversationId = "";
              state.lastResponse = "";
              state.messages = [];
              await saveState(state);
              printSuccess("Starting a new chat session.");
              break;
            }
            const idx = parseInt(ans, 10);
            if (Number.isFinite(idx) && idx >= 1 && idx <= threads.length) {
              selectedIdx = idx - 1;
            } else {
              printWarning(`Please enter a number between 1 and ${threads.length}, or 'x'.`);
            }
          }
          if (selectedIdx !== null) {
            const thread = threads[selectedIdx];
            state.conversationId = thread.id;
            state.lastResponse = "";
            state.messages = [];
            await saveState(state);
            printSuccess(`Loaded conversation: "${thread.title || "(Untitled Chat)"}"`);
          }
        }
      } catch (error) {
        printError(`Failed to load chat history: ${error.message}`);
      }
    } else if (chooseVal.startsWith("new:")) {
      const chatName = chooseVal.slice(4);
      state.conversationId = "";
      state.lastResponse = "";
      state.messages = [];
      await saveState(state);
      printSuccess(`Starting new chat session: "${chatName}"`);
    } else if (chooseVal.startsWith("name:")) {
      const targetName = chooseVal.slice(5).toLowerCase();
      printInfo(`Searching for chat matching "${targetName}"...`);
      try {
        const threads = await listThreads(config);
        const match = threads.find(t => (t.title || "").toLowerCase().includes(targetName));
        if (match) {
          state.conversationId = match.id;
          state.lastResponse = "";
          state.messages = [];
          await saveState(state);
          printSuccess(`Resuming matching chat: "${match.title}"`);
        } else {
          printWarning(`No matching chat found for "${targetName}". Starting a new chat session.`);
          state.conversationId = "";
          state.lastResponse = "";
          state.messages = [];
          await saveState(state);
        }
      } catch (error) {
        printError(`Failed to search chat history: ${error.message}`);
      }
    } else {
      // Treat as direct chat-id
      state.conversationId = chooseVal;
      state.lastResponse = "";
      state.messages = [];
      await saveState(state);
      printSuccess(`Resuming specific chat ID: "${chooseVal}"`);
    }
  }

  let initialPrompt = "";
  if (parsedArgs.prompt) {
    const promptVal = parsedArgs.prompt;
    if (promptVal.startsWith("txt:")) {
      initialPrompt = promptVal.slice(4);
    } else if (promptVal.startsWith("path:")) {
      const filePath = promptVal.slice(5);
      try {
        initialPrompt = await fs.readFile(filePath, "utf8");
      } catch (error) {
        printError(`Failed to read prompt file "${filePath}": ${error.message}`);
      }
    } else {
      initialPrompt = promptVal;
    }
  }

  printBanner(config, state);

  while (true) {
    let line = "";

    if (initialPrompt) {
      line = initialPrompt;
      initialPrompt = "";
    } else {
      try {
        const prompt = getUserPrompt(config.identity.userLabel);
        line = (await rl.question(prompt)).trim();
      } catch (error) {
        if (error?.code === "ERR_USE_AFTER_CLOSE") {
          return;
        }

        throw error;
      }
    }
    if (!line) {
      continue;
    }

    if (line.startsWith("/")) {
      const { command, args } = normalizeCommand(line);

      if (command === "/quit" || command === "/exit") {
        await stopSpeaking();
        rl.close();
        return;
      }

      if (command === "/help") {
        printHelp();
        continue;
      }

      if (command === "/login") {
        if (config.backend !== "sengpt") {
          printWarning("`/login` is only for the older Sengpt backend.");
          continue;
        }
        const tokenConfig = await promptSessionToken(rl);
        if (!tokenConfig.sessionToken && !tokenConfig.sessionTokenChunk0) {
          printWarning("Login cancelled.");
          continue;
        }

        config.sengpt.sessionToken = tokenConfig.sessionToken;
        config.sengpt.sessionTokenChunk0 = tokenConfig.sessionTokenChunk0;
        config.sengpt.sessionTokenChunk1 = tokenConfig.sessionTokenChunk1;
        await saveConfig(config);
        printSuccess("Session token saved locally.");
        continue;
      }

      if (command === "/backend") {
        const backend = args[0]?.toLowerCase();
        if (!["chatgpt-browser", "ollama", "sengpt"].includes(backend)) {
          printWarning("Usage: /backend chatgpt-browser, /backend ollama, or /backend sengpt");
          continue;
        }

        config.backend = backend;
        state.conversationId = "";
        state.lastResponse = "";
        state.messages = [];
        await saveConfig(config);
        setUiConfig(config);
        await saveState(state);
        printSuccess(`Backend set to ${backend}. Started a fresh conversation.`);
        continue;
      }

      if (command === "/terminal") {
        const action = args[0]?.toLowerCase();

        if (action === "stop") {
          await stopSpeaking();
          rl.close();
          return;
        }

        if (action === "config") {
          await openTerminalConfig(rl, config);
          setUiConfig(config);
          continue;
        }

        printWarning("Usage: /terminal stop or /terminal config");
        continue;
      }

      if (command === "/chatgpt") {
        const action = args[0]?.toLowerCase();

        try {
          if (action === "setup") {
            printInfo("Installing the browser-backed ChatGPT gateway...");
            const output = await setupChatgptGateway();
            config.backend = "chatgpt-browser";
            await saveConfig(config);
            printSuccess(output || "ChatGPT gateway setup finished.");
            continue;
          }

          if (action === "start") {
            printInfo("Starting the browser-backed ChatGPT gateway...");
            const output = await startChatgptGateway();
            config.backend = "chatgpt-browser";
            await saveConfig(config);
            printSuccess(output || "ChatGPT gateway started.");
            continue;
          }

          if (action === "login") {
            const output = await openChatgptGatewayLogin();
            printSuccess(output || "Opened the ChatGPT gateway login page.");
            continue;
          }

          if (action === "stop") {
            const output = await stopChatgptGateway();
            printSuccess(output || "ChatGPT gateway stopped.");
            continue;
          }
        } catch (error) {
          printError(error.message);
          continue;
        }

        printWarning("Usage: /chatgpt setup, /chatgpt start, /chatgpt login, or /chatgpt stop");
        continue;
      }

      if (command === "/name") {
        const scope = args[0]?.toLowerCase();
        const value = args.slice(1).join(" ").trim();

        if (scope === "show") {
          printInfo(`you: ${config.identity.userLabel} | bot: ${config.identity.assistantLabel}`);
          continue;
        }

        if (scope === "reset") {
          config.identity.userLabel = "operator";
          config.identity.assistantLabel = "chatgpt";
          await saveConfig(config);
          printSuccess("Chat labels reset.");
          continue;
        }

        if (scope === "me") {
          if (!value) {
            printWarning("Usage: /name me NAME");
            continue;
          }

          config.identity.userLabel = value;
          await saveConfig(config);
          setUiConfig(config);
          printSuccess(`Your label is now ${value}.`);
          continue;
        }

        if (scope === "bot") {
          if (!value) {
            printWarning("Usage: /name bot NAME");
            continue;
          }

          config.identity.assistantLabel = value;
          await saveConfig(config);
          setUiConfig(config);
          printSuccess(`Assistant label is now ${value}.`);
          continue;
        }

        printWarning("Usage: /name me NAME, /name bot NAME, /name show, or /name reset");
        continue;
      }

      if (command === "/clear") {
        try {
          await resetConversation(config, state, true);
        } catch (error) {
          printWarning(error.message);
        }

        state.conversationId = "";
        state.lastResponse = "";
        state.messages = [];
        await saveState(state);
        printSuccess("Started a fresh conversation.");
        continue;
      }

      if (command === "/tts") {
        const option = args[0]?.toLowerCase();
        if (option === "on") {
          config.tts.enabled = true;
        } else if (option === "off") {
          config.tts.enabled = false;
          await stopSpeaking();
        } else {
          config.tts.enabled = !config.tts.enabled;
        }

        await saveConfig(config);
        printSuccess(`TTS ${config.tts.enabled ? "enabled" : "disabled"}.`);
        continue;
      }

      if (command === "/voice") {
        const option = args[0]?.toLowerCase();
        if (option === "list") {
          const voices = await listVoices();
          printInfo(voices.join(", "));
          continue;
        }

        if (option === "preview") {
          const voice = args.slice(1).join(" ").trim();
          if (!voice) {
            printWarning("Usage: /voice preview NAME");
            continue;
          }

          try {
            await stopSpeaking();
            void speakText("Voice preview from your terminal chat.", {
              ...config.tts,
              voice
            }).catch((error) => {
              printError(error.message);
            });
            printSuccess(`Previewing ${voice}.`);
          } catch (error) {
            printError(error.message);
          }
          continue;
        }

        if (option === "set") {
          const voice = args.slice(1).join(" ").trim();
          if (!voice) {
            printWarning("Usage: /voice set NAME");
            continue;
          }

          config.tts.voice = voice;
          await saveConfig(config);
          printSuccess(`Voice set to ${voice}.`);
          continue;
        }

        printWarning("Usage: /voice list, /voice preview NAME, or /voice set NAME");
        continue;
      }

      if (command === "/repeat") {
        if (!state.lastResponse) {
          printWarning("There is no response to replay yet.");
          continue;
        }

        if (!config.tts.enabled) {
          printWarning("TTS is currently off.");
          continue;
        }

        try {
          void speakText(state.lastResponse, config.tts).catch((error) => {
            printError(error.message);
          });
        } catch (error) {
          printError(error.message);
        }
        continue;
      }

      if (command === "/model") {
        const model = args.join(" ").trim();
        if (!model) {
          printWarning("Usage: /model NAME");
          continue;
        }

        if (config.backend === "ollama") {
          config.ollama.model = model;
        } else if (config.backend === "chatgpt-browser") {
          config.chatgptBrowser.model = model;
        } else {
          config.sengpt.model = model;
        }
        state.conversationId = "";
        state.messages = [];
        await saveConfig(config);
        await saveState(state);
        printSuccess(`Model set to ${model}. A new conversation will be used next.`);
        continue;
      }

      if (command === "/models") {
        try {
          const models = await listModels(config);
          printInfo(models.join(", "));
        } catch (error) {
          printError(error.message);
        }
        continue;
      }

      if (command === "/status") {
        const backendStatus = await getBackendStatus(config);
        printStatus(config, backendStatus);
        continue;
      }

      const suggestions = rankCommandSuggestions(line);
      printWarning("Unknown command. Type /help or press Tab for autocomplete.");
      if (suggestions.length) {
        printInfo(`Suggestions: ${suggestions.join("  |  ")}`);
      }
      continue;
    }

    if (process.stdout.isTTY) {
      readlineUi.moveCursor(output, 0, -1);
      readlineUi.clearLine(output, 0);
      readlineUi.cursorTo(output, 0);
    }

    printUserMessage(config.identity.userLabel, line);

    const backendStatus = await getBackendStatus(config);
    if (config.backend === "sengpt" && !backendStatus.hasToken) {
      printWarning("No session token is configured. Use /login first.");
      continue;
    }

    const assistantLabel =
      config.backend === "ollama"
        ? config.identity.assistantLabel || config.ollama.model
        : config.identity.assistantLabel;
    const loadingLabel =
      config.backend === "ollama"
        ? "querying local model"
        : config.backend === "chatgpt-browser"
          ? "routing through browser relay"
          : "contacting legacy bridge";
    let responseText = "";
    let didRenderResponse = false;
    const stopLoadingIndicator = startLoadingIndicator(loadingLabel);

    try {
      await stopSpeaking();
      const result = await sendMessage({
        config,
        state,
        prompt: line,
        onChunk(chunk) {
          if (!didRenderResponse) {
            stopLoadingIndicator();
            printAssistantHeader(assistantLabel);
            didRenderResponse = true;
          }

          responseText += chunk;
          process.stdout.write(chunk);
        }
      });

      if (!didRenderResponse) {
        stopLoadingIndicator();
        printAssistantHeader(assistantLabel);
        didRenderResponse = true;
        responseText = result.response || "";
        process.stdout.write(responseText);
      }

      process.stdout.write("\n");

      state.conversationId = result.conversationId || state.conversationId || "";
      state.lastResponse = (result.response || responseText).trim();
      if (result.messages) {
        state.messages = result.messages;
      }

      await appendTranscript({
        timestamp: new Date().toISOString(),
        prompt: line,
        response: state.lastResponse,
        conversationId: state.conversationId,
        backend: config.backend,
        model:
          config.backend === "ollama"
            ? config.ollama.model
            : config.backend === "chatgpt-browser"
              ? config.chatgptBrowser.model
              : config.sengpt.model
      });

      await saveState(state);

      if (config.tts.enabled && state.lastResponse) {
        void speakText(state.lastResponse, config.tts).catch((error) => {
          printError(error.message);
        });
      }
    } catch (error) {
      stopLoadingIndicator();
      process.stdout.write("\n");
      printError(error.message);
    }
  }
}

main().catch((error) => {
  printError(error.stack || error.message);
  process.exit(1);
});
