const THEME_PRESETS = {
  nightwire: {
    name: "Nightwire",
    border: "#1b3326",
    panel: "#9df7c1",
    dim: "#4d6a5b",
    user: "#73ffd1",
    assistant: "#8fb8ff",
    info: "#5ad5ff",
    success: "#78ff8f",
    warning: "#ffcf68",
    error: "#ff7187",
    userBg: "#0a1711",
    assistantBg: "#121723",
    errorBg: "#18040a",
    pillFg: "#06110b"
  },
  matrix: {
    name: "Matrix",
    border: "#153418",
    panel: "#8dff72",
    dim: "#3f6840",
    user: "#c7ff9d",
    assistant: "#7eff72",
    info: "#6dffc3",
    success: "#98ff72",
    warning: "#e3ff72",
    error: "#ff7272",
    userBg: "#081208",
    assistantBg: "#0a180a",
    errorBg: "#180808",
    pillFg: "#041004"
  },
  dracula: {
    name: "Dracula",
    border: "#2e2942",
    panel: "#ffb7f7",
    dim: "#7e7195",
    user: "#8be9fd",
    assistant: "#bd93f9",
    info: "#f1fa8c",
    success: "#50fa7b",
    warning: "#ffb86c",
    error: "#ff5555",
    userBg: "#161420",
    assistantBg: "#241f33",
    errorBg: "#2a1016",
    pillFg: "#120f1c"
  },
  amber: {
    name: "Amber CRT",
    border: "#4d2d11",
    panel: "#ffbf72",
    dim: "#886442",
    user: "#ffd08f",
    assistant: "#ffe1b5",
    info: "#ffcf7a",
    success: "#ffd37b",
    warning: "#ffb347",
    error: "#ff7b54",
    userBg: "#1d1206",
    assistantBg: "#251708",
    errorBg: "#2a1207",
    pillFg: "#140b03"
  },
  frost: {
    name: "Frost",
    border: "#163144",
    panel: "#9be7ff",
    dim: "#577080",
    user: "#d8f8ff",
    assistant: "#8cbfff",
    info: "#7deeff",
    success: "#a7ffe2",
    warning: "#ffe68a",
    error: "#ff8ca1",
    userBg: "#0b1520",
    assistantBg: "#101929",
    errorBg: "#261019",
    pillFg: "#061019"
  }
};

const GLYPH_PRESETS = {
  operator: {
    name: "Operator",
    userSigil: ">>",
    assistantSigil: "::",
    promptTail: ">",
    loaderFrames: ["[      ]", "[=     ]", "[==    ]", "[===   ]", "[ ==== ]", "[  === ]"]
  },
  matrix: {
    name: "Matrix",
    userSigil: "λ",
    assistantSigil: "¤",
    promptTail: "›",
    loaderFrames: ["[000000]", "[001100]", "[011110]", "[111111]", "[110011]", "[100001]"]
  },
  arcade: {
    name: "Arcade",
    userSigil: "1UP",
    assistantSigil: "CPU",
    promptTail: ">>",
    loaderFrames: ["<....>", "<#...>", "<##..>", "<###.>", "<####>", "<.###>"]
  },
  ghost: {
    name: "Ghost",
    userSigil: "//",
    assistantSigil: "##",
    promptTail: "»",
    loaderFrames: ["░░░░░░", "▒░░░░░", "▓▒░░░░", "█▓▒░░░", "▓█▓▒░░", "▒▓█▓▒░"]
  },
  runes: {
    name: "Runes",
    userSigil: "ᚠ",
    assistantSigil: "ᚱ",
    promptTail: "›",
    loaderFrames: ["ᚠ·····", "ᚠᚱ····", "ᚠᚱᚲ···", "ᚠᚱᚲᚷ··", "ᚠᚱᚲᚷᚺ·", "ᚠᚱᚲᚷᚺᚾ"]
  }
};

export function listThemeOptions() {
  return Object.entries(THEME_PRESETS).map(([id, theme]) => ({ id, name: theme.name }));
}

export function listGlyphOptions() {
  return Object.entries(GLYPH_PRESETS).map(([id, glyph]) => ({ id, name: glyph.name }));
}

export function getThemePreset(id = "nightwire") {
  return THEME_PRESETS[id] || THEME_PRESETS.nightwire;
}

export function getGlyphPreset(id = "operator") {
  return GLYPH_PRESETS[id] || GLYPH_PRESETS.operator;
}

export const DEFAULT_THEME_ID = "nightwire";
export const DEFAULT_GLYPH_ID = "operator";
