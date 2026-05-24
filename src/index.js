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

const SUPPORTED_BACKENDS = ["chatgpt-browser", "ollama", "sengpt"];

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

function parseCliArgs(argv) {
  const parsedArgs = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--bot=")) {
      parsedArgs.bot = arg.slice(6);
    } else if (arg === "--bot") {
      parsedArgs.bot = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--choose=")) {
      parsedArgs.choose = arg.slice(9);
    } else if (arg === "--choose") {
      parsedArgs.choose = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--prompt=")) {
      parsedArgs.prompt = arg.slice(9);
    } else if (arg === "--prompt") {
      parsedArgs.prompt = argv[i + 1];
      i += 1;
    }
  }

  return parsedArgs;
}

function resetLocalConversationState(state) {
  state.conversationId = "";
  state.lastResponse = "";
  state.messages = [];
}

async function resetSavedConversationState(state) {
  resetLocalConversationState(state);
  await saveState(state);
}

function getConfiguredModel(config) {
  if (config.backend === "ollama") {
    return config.ollama.model;
  }

  if (config.backend === "chatgpt-browser") {
    return config.chatgptBrowser.model;
  }

  return config.sengpt.model;
}

function getAssistantLabel(config) {
  if (config.backend === "ollama") {
    return config.identity.assistantLabel || config.ollama.model;
  }

  return config.identity.assistantLabel;
}

function getLoadingLabel(config) {
  if (config.backend === "ollama") {
    return "querying local model";
  }

  if (config.backend === "chatgpt-browser") {
    return "routing through browser relay";
  }

  return "contacting legacy bridge";
}

async function terminateTerminalSession(rl, config) {
  await stopSpeaking(config);
  if (!rl.closed) {
    rl.close();
  }
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

async function chooseChatThread(rl, config, state) {
  printInfo("Fetching recent ChatGPT conversations...");

  const threads = await listThreads(config);
  if (threads.length === 0) {
    await resetSavedConversationState(state);
    printWarning("No recent chats were found. Starting a new chat.");
    return;
  }

  const visibleThreads = threads.slice(0, 12);
  const savedIndex = visibleThreads.findIndex((thread) => thread.id === state.conversationId);

  printPanel("RECENT CHATS", [
    ...visibleThreads.map((thread, index) => {
      const prefix = `${String(index + 1).padStart(2, " ")}.`;
      const status = index === savedIndex ? " [current]" : "";
      const title = thread.title?.replace(/\s+/gu, " ").trim() || "(Untitled Chat)";
      return `${prefix} ${title}${status}`;
    }),
    "",
    "n. Start new chat",
    ...(savedIndex >= 0 ? ["Enter: keep current chat"] : [])
  ]);

  while (true) {
    const answer = (await rl.question("chat > ")).trim();

    if (!answer && savedIndex >= 0) {
      const thread = visibleThreads[savedIndex];
      resetLocalConversationState(state);
      state.conversationId = thread.id;
      await saveState(state);
      printSuccess(`Keeping chat: "${thread.title || "(Untitled Chat)"}"`);
      return;
    }

    if (!answer || answer.toLowerCase() === "n" || answer.toLowerCase() === "x") {
      await resetSavedConversationState(state);
      printSuccess("Starting a new chat.");
      return;
    }

    const index = Number.parseInt(answer, 10);
    if (Number.isFinite(index) && index >= 1 && index <= visibleThreads.length) {
      const thread = visibleThreads[index - 1];
      resetLocalConversationState(state);
      state.conversationId = thread.id;
      await saveState(state);
      printSuccess(`Loaded chat: "${thread.title || "(Untitled Chat)"}"`);
      return;
    }

    const enterHint = savedIndex >= 0 ? ", Enter" : "";
    printWarning(`Choose 1-${visibleThreads.length}, n${enterHint}.`);
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
      await stopSpeaking(config);
      void speakText("This is your current local voice preview.", config.tts, config).catch((error) => {
        printError(error.message);
      });
      printInfo(`Previewing ${config.tts.engine === "browser" ? "browser-native" : config.tts.voice}.`);
      continue;
    }

    printWarning("Choose 1-8.");
  }
}

async function ensureChatgptRelayReady(config) {
  let status = await getBackendStatus(config);

  if (!status.ok) {
    printInfo("Starting headless ChatGPT relay in the background...");
    await startChatgptGateway();
    status = await getBackendStatus(config);
  }

  if (status.ok && status.loggedIn) {
    return { ready: true, status };
  }

  if (status.ok && !status.loggedIn) {
    printInfo("ChatGPT login is required. Opening the visible login helper...");
    await stopChatgptGateway();
    await openChatgptGatewayLogin();
    printSuccess("Login helper opened. Sign in there, then rerun `npm start` to choose a chat.");
    return { ready: false, status };
  }

  return { ready: false, status };
}

async function main() {
  await ensureAppDirs();
  const config = await loadConfig();
  const state = await loadState();
  setUiConfig(config);

  const parsedArgs = parseCliArgs(process.argv);

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
    await resetSavedConversationState(state);
  }

  if (!(await canUseLocalTts())) {
    config.tts.enabled = false;
    await saveConfig(config);
  }

  const rl = readline.createInterface({
    input,
    output,
    terminal: process.stdin.isTTY,
    completer: completeCommand
  });

  process.on("SIGINT", async () => {
    await terminateTerminalSession(rl, config);
    process.exit(0);
  });

  if (config.backend === "chatgpt-browser" && config.terminal.autoRestartRelay) {
    try {
      const relay = await ensureChatgptRelayReady(config);
      if (!relay.ready) {
        rl.close();
        return;
      }
    } catch (error) {
      printError(`ChatGPT relay startup failed: ${error.message}`);
      rl.close();
      return;
    }
  }

  // If no choose option or prompt is specified, always ask the user which chat to continue from by default!
  if (!parsedArgs.choose && !parsedArgs.prompt) {
    parsedArgs.choose = "from-chat-history";
  }

  if (parsedArgs.choose) {
    const chooseVal = parsedArgs.choose;
    if (chooseVal === "from-chat-history") {
      try {
        await chooseChatThread(rl, config, state);
      } catch (error) {
        printError(`Failed to load chat history: ${error.message}`);
      }
    } else if (chooseVal.startsWith("new:")) {
      const chatName = chooseVal.slice(4);
      await resetSavedConversationState(state);
      printSuccess(`Starting new chat session: "${chatName}"`);
    } else if (chooseVal.startsWith("name:")) {
      const targetName = chooseVal.slice(5).toLowerCase();
      printInfo(`Searching for chat matching "${targetName}"...`);
      try {
        const threads = await listThreads(config);
        const match = threads.find(t => (t.title || "").toLowerCase().includes(targetName));
        if (match) {
          resetLocalConversationState(state);
          state.conversationId = match.id;
          await saveState(state);
          printSuccess(`Resuming matching chat: "${match.title}"`);
        } else {
          printWarning(`No matching chat found for "${targetName}". Starting a new chat session.`);
          await resetSavedConversationState(state);
        }
      } catch (error) {
        printError(`Failed to search chat history: ${error.message}`);
      }
    } else {
      // Treat as direct chat-id
      resetLocalConversationState(state);
      state.conversationId = chooseVal;
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
        await terminateTerminalSession(rl, config);
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
        if (!SUPPORTED_BACKENDS.includes(backend)) {
          printWarning("Usage: /backend chatgpt-browser, /backend ollama, or /backend sengpt");
          continue;
        }

        config.backend = backend;
        resetLocalConversationState(state);
        await saveConfig(config);
        setUiConfig(config);
        await saveState(state);
        printSuccess(`Backend set to ${backend}. Started a fresh conversation.`);
        continue;
      }

      if (command === "/terminal") {
        const action = args[0]?.toLowerCase();

        if (action === "stop") {
          await terminateTerminalSession(rl, config);
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
            await stopChatgptGateway();
            await openChatgptGatewayLogin();
            printSuccess(
              "Opened the ChatGPT login helper. This terminal chat session will close while you sign in."
            );
            await terminateTerminalSession(rl, config);
            return;
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

        await resetSavedConversationState(state);
        printSuccess("Started a fresh conversation.");
        continue;
      }

      if (command === "/tts") {
        const option = args[0]?.toLowerCase();
        if (option === "on") {
          config.tts.enabled = true;
        } else if (option === "off") {
          config.tts.enabled = false;
          await stopSpeaking(config);
        } else if (option === "engine") {
          const engineVal = args[1]?.toLowerCase();
          if (["say", "browser"].includes(engineVal)) {
            config.tts.engine = engineVal;
            await stopSpeaking(config);
            await saveConfig(config);
            printSuccess(`TTS engine set to ${engineVal}.`);
            continue;
          } else {
            printWarning("Usage: /tts engine say  |  /tts engine browser");
            continue;
          }
        } else {
          config.tts.enabled = !config.tts.enabled;
          if (!config.tts.enabled) {
            await stopSpeaking(config);
          }
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
            await stopSpeaking(config);
            void speakText("Voice preview from your terminal chat.", {
              ...config.tts,
              voice
            }, config).catch((error) => {
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
          void speakText(state.lastResponse, config.tts, config).catch((error) => {
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
        resetLocalConversationState(state);
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

    const assistantLabel = getAssistantLabel(config);
    const loadingLabel = getLoadingLabel(config);
    let responseText = "";
    let didRenderResponse = false;
    const stopLoadingIndicator = startLoadingIndicator(loadingLabel);

    try {
      await stopSpeaking(config);
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
        model: getConfiguredModel(config)
      });

      await saveState(state);

      if (config.tts.enabled && state.lastResponse) {
        void speakText(state.lastResponse, config.tts, config).catch((error) => {
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
