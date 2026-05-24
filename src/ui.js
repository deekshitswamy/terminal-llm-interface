import chalk from "chalk";
import { CONFIG_PATH, LOG_PATH, STATE_PATH } from "./paths.js";
import {
  DEFAULT_GLYPH_ID,
  DEFAULT_THEME_ID,
  getGlyphPreset,
  getThemePreset
} from "./presets.js";

let activeTheme = getThemePreset(DEFAULT_THEME_ID);
let activeGlyphs = getGlyphPreset(DEFAULT_GLYPH_ID);

function terminalWidth() {
  return Math.min(Math.max(process.stdout.columns || 96, 72), 108);
}

function wrapText(text, width) {
  const source = String(text ?? "");
  if (!source) {
    return [""];
  }

  const lines = [];

  for (const rawLine of source.split("\n")) {
    if (!rawLine) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of rawLine.split(/\s+/u)) {
      if (!word) {
        continue;
      }

      if (!current) {
        if (word.length <= width) {
          current = word;
          continue;
        }

        for (let index = 0; index < word.length; index += width) {
          lines.push(word.slice(index, index + width));
        }
        current = "";
        continue;
      }

      if (current.length + 1 + word.length <= width) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        if (word.length <= width) {
          current = word;
        } else {
          for (let index = 0; index < word.length; index += width) {
            lines.push(word.slice(index, index + width));
          }
          current = "";
        }
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines.length ? lines : [""];
}

export function setUiConfig(config) {
  activeTheme = getThemePreset(config.appearance?.theme);
  activeGlyphs = getGlyphPreset(config.appearance?.glyphs);
}

export function printPanel(title, lines, color = activeTheme.panel) {
  const innerWidth = terminalWidth() - 4;
  const prepared = lines.flatMap((line) => wrapText(line, innerWidth));
  const titleText = ` ${title} `;
  const top = `┌${titleText}${"─".repeat(Math.max(0, innerWidth - titleText.length))}┐`;
  const bottom = `└${"─".repeat(innerWidth + 2)}┘`;

  console.log(chalk.hex(color)(top));
  for (const line of prepared) {
    console.log(chalk.hex(color)(`│ ${line.padEnd(innerWidth)} │`));
  }
  console.log(chalk.hex(color)(bottom));
}

function printTagged(tag, color, message) {
  const pill = chalk.bgHex(color).hex(activeTheme.pillFg).bold(` ${tag} `);
  console.log(`${pill} ${chalk.hex(color)(message)}`);
}

function renderSpeakerPill(label, color) {
  return `${chalk.hex(color).bold(label)} ${chalk.hex(color).bold("> ")} `;
}

function renderLanePreview(userLabel, botLabel) {
  const userLane = `${chalk.hex(activeTheme.user).bold(userLabel)} ${chalk.hex(activeTheme.user).bold(">")}`;
  const botLane = `${chalk.hex(activeTheme.assistant).bold(botLabel)} ${chalk.hex(activeTheme.assistant).bold(">")}`;
  return `${userLane}    ${chalk.hex(activeTheme.dim)("//")}    ${botLane}`;
}

export function printBanner(config, state) {
  setUiConfig(config);

  if (process.stdout.isTTY) {
    console.clear();
  }

  const lines = [
    "NIGHTWIRE // terminal relay",
    `backend  ${config.backend}`,
    `theme    ${getThemePreset(config.appearance.theme).name}`,
    `glyphs   ${getGlyphPreset(config.appearance.glyphs).name}`,
    `chat     ${config.identity.userLabel} > ${config.identity.assistantLabel} >`,
    `voice    ${config.tts.enabled ? (config.tts.engine === "browser" ? "browser-native" : `${config.tts.voice} local-say`) : "muted"}`,
    `thread   ${state.conversationId ? "resuming saved session" : "fresh session"}`
  ];

  printPanel("DARK CHAT INTERFACE", lines, activeTheme.panel);
  printPanel(
    "CHAT LANE",
    [
      renderLanePreview(config.identity.userLabel, config.identity.assistantLabel),
      `${activeGlyphs.userSigil} you speak here`,
      `${activeGlyphs.assistantSigil} ${config.identity.assistantLabel} replies here`
    ],
    activeTheme.user
  );
  console.log(
    chalk
      .hex(activeTheme.dim)(
        "Type /help for commands. Press Tab to autocomplete. `/terminal config` opens the in-terminal control deck.\n"
      )
  );
}

export function getUserPrompt(label = "operator") {
  return renderSpeakerPill(label, activeTheme.user);
}

export function printAssistantHeader(label = "assistant") {
  process.stdout.write(renderSpeakerPill(label, activeTheme.assistant));
}

export function printUserMessage(label = "operator", message = "") {
  process.stdout.write(renderSpeakerPill(label, activeTheme.user));
  process.stdout.write(`${chalk.hex(activeTheme.user)(message)}\n`);
}

export function startLoadingIndicator(message) {
  let frameIndex = 0;
  let stopped = false;
  const frames = activeGlyphs.loaderFrames;

  const render = () => {
    const frame = frames[frameIndex % frames.length];
    frameIndex += 1;
    process.stdout.write(`\r${chalk.hex(activeTheme.dim)(`${frame} ${message}`)}`);
  };

  render();
  const timer = setInterval(render, 120);

  return () => {
    if (stopped) {
      return;
    }

    stopped = true;
    clearInterval(timer);
    process.stdout.write(`\r${" ".repeat(message.length + 16)}\r`);
  };
}

export function printInfo(message) {
  printTagged("INFO", activeTheme.info, message);
}

export function printSuccess(message) {
  printTagged("SYNC", activeTheme.success, message);
}

export function printWarning(message) {
  printTagged("WARN", activeTheme.warning, message);
}

export function printError(message) {
  const pill = chalk.bgHex(activeTheme.error).hex(activeTheme.errorBg).bold(" FAIL ");
  console.error(`${pill} ${chalk.hex(activeTheme.error)(message)}`);
}

export function printHelp() {
  printPanel(
    "COMMAND DECK",
    [
      "/help                      show this help",
      "/terminal stop             close the current terminal chat session",
      "/terminal config           open the in-terminal control deck",
      "/backend NAME              switch backend: chatgpt-browser, ollama, sengpt",
      "/chatgpt setup             install the browser-backed ChatGPT gateway",
      "/chatgpt start             start the browser-backed ChatGPT gateway",
      "/chatgpt login             open the one-time ChatGPT browser login window",
      "/chatgpt stop              stop the browser-backed ChatGPT gateway",
      "/name me NAME              change your chat tag",
      "/name bot NAME             change the assistant chat tag",
      "/name show                 show current tags",
      "/name reset                reset tags to defaults",
      "/models                    list models for the active backend",
      "/model NAME                change the active model",
      "/login                     store session token for legacy Sengpt",
      "/clear                     start a fresh conversation",
      "/tts on|off|toggle         control local text-to-speech",
      "/voice list                list installed macOS voices",
      "/voice preview NAME        preview a voice immediately",
      "/voice set NAME            change the TTS voice",
      "/repeat                    replay the last spoken response",
      "/status                    show backend, tag, and file locations",
      "/quit                      exit the app"
    ],
    activeTheme.panel
  );
}

export function printStatus(config, backendStatus) {
  const lines = [`backend  ${config.backend}`];

  if (config.backend === "ollama") {
    lines.push(`gateway  ${backendStatus.ok ? "reachable" : "unreachable"}`);
    lines.push(`base     ${backendStatus.baseUrl}`);
    lines.push(`model    ${config.ollama.model}`);
    if (backendStatus.models?.length) {
      lines.push(`models   ${backendStatus.models.join(", ")}`);
    }
  } else if (config.backend === "chatgpt-browser") {
    lines.push(`relay    ${backendStatus.ok ? "reachable" : "unreachable"}`);
    lines.push(`base     ${backendStatus.baseUrl}`);
    lines.push(`model    ${config.chatgptBrowser.model}`);
    lines.push(`login    ${backendStatus.loggedIn ? "active" : "unknown"}`);
    if (backendStatus.currentThread) {
      lines.push(`thread   ${backendStatus.currentThread}`);
    }
  } else {
    lines.push(`python   ${backendStatus.pythonPath}`);
    lines.push(`token    ${backendStatus.hasToken ? "configured" : "missing"}`);
    lines.push(`model    ${config.sengpt.model}`);
  }

  lines.push(`theme    ${getThemePreset(config.appearance.theme).name}`);
  lines.push(`glyphs   ${getGlyphPreset(config.appearance.glyphs).name}`);
  lines.push(`you      ${config.identity.userLabel}`);
  lines.push(`bot      ${config.identity.assistantLabel}`);
  lines.push(`tts      ${config.tts.enabled ? `enabled (${config.tts.engine || "say"})` : "disabled"}`);
  lines.push(`voice    ${config.tts.engine === "browser" ? "browser-native" : config.tts.voice}`);
  lines.push(`config   ${CONFIG_PATH}`);
  lines.push(`state    ${STATE_PATH}`);
  lines.push(`logs     ${LOG_PATH}`);

  printPanel("STATUS PANEL", lines, activeTheme.panel);
}
