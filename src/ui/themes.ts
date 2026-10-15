import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";

export interface ThemeColors {
  name: string;
  displayName: string;
  primary: string;
  secondary: string;
  border: string;
  text: string;
  muted: string;
  success: string;
  warning: string;
  error: string;
  diffAdded: string;
  diffRemoved: string;
  badgeBg: string;
  badgeFg: string;
}

export const THEMES: Record<string, ThemeColors> = {
  tokyonight: {
    name: "tokyonight",
    displayName: "Tokyo Night (Default)",
    primary: "#7aa2f7",
    secondary: "#bb9af7",
    border: "#3b4261",
    text: "#c0caf5",
    muted: "#565f89",
    success: "#9ece6a",
    warning: "#e0af68",
    error: "#f7768e",
    diffAdded: "#9ece6a",
    diffRemoved: "#f7768e",
    badgeBg: "#7aa2f7",
    badgeFg: "#1a1b26",
  },
  catppuccin: {
    name: "catppuccin",
    displayName: "Catppuccin Mocha",
    primary: "#cba6f7",
    secondary: "#89b4fa",
    border: "#45475a",
    text: "#cdd6f4",
    muted: "#6c7086",
    success: "#a6e3a1",
    warning: "#f9e2af",
    error: "#f38ba8",
    diffAdded: "#a6e3a1",
    diffRemoved: "#f38ba8",
    badgeBg: "#cba6f7",
    badgeFg: "#11111b",
  },
  nord: {
    name: "nord",
    displayName: "Nord Arctic",
    primary: "#88c0d0",
    secondary: "#81a1c1",
    border: "#4c566a",
    text: "#eceff4",
    muted: "#616e88",
    success: "#a3be8c",
    warning: "#ebcb8b",
    error: "#bf616a",
    diffAdded: "#a3be8c",
    diffRemoved: "#bf616a",
    badgeBg: "#88c0d0",
    badgeFg: "#2e3440",
  },
  gruvbox: {
    name: "gruvbox",
    displayName: "Gruvbox Dark",
    primary: "#fabd2f",
    secondary: "#fe8019",
    border: "#504945",
    text: "#ebdbb2",
    muted: "#7c6f64",
    success: "#b8bb26",
    warning: "#fabd2f",
    error: "#fb4934",
    diffAdded: "#b8bb26",
    diffRemoved: "#fb4934",
    badgeBg: "#fabd2f",
    badgeFg: "#282828",
  },
  everforest: {
    name: "everforest",
    displayName: "Everforest Dark",
    primary: "#a7c080",
    secondary: "#7fbbb3",
    border: "#475258",
    text: "#d3c6aa",
    muted: "#7a8478",
    success: "#a7c080",
    warning: "#dbbc7f",
    error: "#e67e80",
    diffAdded: "#a7c080",
    diffRemoved: "#e67e80",
    badgeBg: "#a7c080",
    badgeFg: "#2d353b",
  },
  "one-dark": {
    name: "one-dark",
    displayName: "One Dark Pro",
    primary: "#61afef",
    secondary: "#c678dd",
    border: "#3e4451",
    text: "#abb2bf",
    muted: "#5c6370",
    success: "#98c379",
    warning: "#e5c07b",
    error: "#e06c75",
    diffAdded: "#98c379",
    diffRemoved: "#e06c75",
    badgeBg: "#61afef",
    badgeFg: "#282c34",
  },
  matrix: {
    name: "matrix",
    displayName: "Matrix Green",
    primary: "#00ff66",
    secondary: "#00cc44",
    border: "#005511",
    text: "#ddffdd",
    muted: "#007722",
    success: "#00ff66",
    warning: "#ffff00",
    error: "#ff3333",
    diffAdded: "#00ff66",
    diffRemoved: "#ff3333",
    badgeBg: "#00ff66",
    badgeFg: "#001100",
  },
  system: {
    name: "system",
    displayName: "System ANSI Terminal",
    primary: "#00ffff",
    secondary: "#ff00ff",
    border: "#808080",
    text: "#ffffff",
    muted: "#808080",
    success: "#00ff00",
    warning: "#ffff00",
    error: "#ff0000",
    diffAdded: "#00ff00",
    diffRemoved: "#ff0000",
    badgeBg: "#00ffff",
    badgeFg: "#000000",
  },
};

let currentTheme: ThemeColors = THEMES.tokyonight;

export function getTheme(name?: string): ThemeColors {
  if (!name) return currentTheme;
  const key = name.toLowerCase().trim();
  return THEMES[key] || currentTheme;
}

export function getCurrentTheme(): ThemeColors {
  return currentTheme;
}

export function getTuiConfigPath(workspaceRoot: string = process.cwd()): string {
  const agentDir = path.join(workspaceRoot, ".agent");
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }
  return path.join(agentDir, "tui.json");
}

export function loadThemePreference(workspaceRoot: string = process.cwd()): string {
  try {
    const configPath = getTuiConfigPath(workspaceRoot);
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (data.theme && THEMES[data.theme]) {
        currentTheme = THEMES[data.theme];
        return data.theme;
      }
    }
  } catch {
    // Ignore config read errors
  }
  return "tokyonight";
}

export function setTheme(name: string, workspaceRoot: string = process.cwd()): ThemeColors {
  const theme = getTheme(name);
  currentTheme = theme;

  try {
    const configPath = getTuiConfigPath(workspaceRoot);
    let existingConfig: any = {};
    if (fs.existsSync(configPath)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      } catch {
        existingConfig = {};
      }
    }
    existingConfig.$schema = "https://opencode.ai/tui.json";
    existingConfig.theme = theme.name;
    fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), "utf8");
  } catch {
    // Ignore config write errors
  }

  return currentTheme;
}

/**
 * Returns chalk colorized text using active theme tokens
 */
export const themeChalk = {
  primary: (text: string) => chalk.hex(currentTheme.primary)(text),
  secondary: (text: string) => chalk.hex(currentTheme.secondary)(text),
  text: (text: string) => chalk.hex(currentTheme.text)(text),
  muted: (text: string) => chalk.hex(currentTheme.muted)(text),
  border: (text: string) => chalk.hex(currentTheme.border)(text),
  success: (text: string) => chalk.hex(currentTheme.success)(text),
  warning: (text: string) => chalk.hex(currentTheme.warning)(text),
  error: (text: string) => chalk.hex(currentTheme.error)(text),
  badge: (label: string) =>
    chalk.bgHex(currentTheme.badgeBg).hex(currentTheme.badgeFg).bold(` ${label} `),
};
