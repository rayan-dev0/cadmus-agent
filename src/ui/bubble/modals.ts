import boxen from "boxen";
import chalk from "chalk";
import { OpenCodeModel } from "./model.js";
import { THEMES } from "../themes.js";
import { formatTerminalDiff } from "../../tools/diffViewer.js";
import { SLASH_COMMANDS } from "../commandCatalog.js";

/**
 * Renders the interactive Diff Approval modal
 */
export function renderDiffModal(model: OpenCodeModel): string {
  const theme = model.theme;
  const state = model.modalState || {};
  const { filePath = "file", patch = "", additions = 0, deletions = 0 } = state;

  const header =
    chalk.bold.hex(theme.primary)("⚡ OpenCode Diff Review: ") +
    chalk.bold.white(filePath) +
    "  " +
    chalk.green(`+${additions}`) +
    " " +
    chalk.red(`-${deletions}`);

  const diffPreview = patch ? formatTerminalDiff(patch) : chalk.dim("(No diff content)");

  const actions = [
    chalk.bold.green("[a] Accept (Enter)"),
    chalk.bold.red("[r] Reject (Esc)"),
    chalk.bold.yellow("[y] Always Allow This Session"),
  ].join("   ");

  const content = `${header}\n\n${diffPreview}\n\n${actions}`;

  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 2, right: 2 },
    borderStyle: "round",
    borderColor: theme.warning as any,
  });
}

/**
 * Renders the Confirmation modal
 */
export function renderConfirmModal(model: OpenCodeModel): string {
  const theme = model.theme;
  const state = model.modalState || {};
  const prompt = state.prompt || "Do you confirm this action?";

  const header = chalk.bold.hex(theme.warning)("⚠ OpenCode Permission Request");
  const actions = chalk.bold("[y] Yes (Enter)    [n] No (Esc)");
  const content = `${header}\n\n${chalk.white(prompt)}\n\n${actions}`;

  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 4, right: 4 },
    borderStyle: "round",
    borderColor: theme.warning as any,
  });
}

/**
 * Renders OpenCode Global Command Palette (Ctrl+P)
 */
export function renderCommandPaletteModal(model: OpenCodeModel): string {
  const theme = model.theme;
  const state = model.modalState || { query: "", selectedIndex: 0 };
  const query = state.query || "";
  const selectedIndex = state.selectedIndex || 0;

  const filtered = SLASH_COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase()) ||
    cmd.description.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 7);

  const header = chalk.bold.hex(theme.primary)("OpenCode Command Palette (Ctrl+P)");
  const searchInput = `${chalk.dim("Find >")} ${chalk.bold.white(query)}█`;

  const items = filtered.map((cmd, idx) => {
    const isSelected = idx === selectedIndex;
    const prefix = isSelected ? chalk.hex(theme.primary)("❯ ") : "  ";
    const name = isSelected
      ? chalk.bold.hex(theme.primary)(cmd.name)
      : chalk.white(cmd.name);
    const desc = chalk.dim(`- ${cmd.description}`);
    return `${prefix}${name} ${desc}`;
  });

  const footer = chalk.dim("↑/↓ to navigate • Enter to select • Esc to cancel");
  const content = `${header}\n${searchInput}\n\n${items.join("\n") || chalk.dim("  No matching commands")}\n\n${footer}`;

  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 4, right: 4 },
    borderStyle: "round",
    borderColor: theme.primary as any,
  });
}

/**
 * Renders OpenCode Leader Key (Ctrl+X) shortcuts HUD
 */
export function renderLeaderKeyModal(model: OpenCodeModel): string {
  const theme = model.theme;
  const header = chalk.bold.hex(theme.warning)("OpenCode Leader Key (Ctrl+X)");
  const shortcuts = [
    `  ${chalk.yellow("n")} - New session (/clear)           ${chalk.yellow("m")} - Model catalog (/models)`,
    `  ${chalk.yellow("l")} - Switch session (/sessions)      ${chalk.yellow("c")} - Compact history (/compact)`,
    `  ${chalk.yellow("u")} - Undo last turn (/undo)          ${chalk.yellow("d")} - Toggle tool details (/details)`,
    `  ${chalk.yellow("t")} - Switch theme (/theme)           ${chalk.yellow("q")} - Exit agent (/exit)`,
  ];
  const footer = chalk.dim("Press shortcut key or Esc to dismiss");
  const content = `${header}\n\n${shortcuts.join("\n")}\n\n${footer}`;

  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 4, right: 4 },
    borderStyle: "round",
    borderColor: theme.warning as any,
  });
}

/**
 * Renders OpenCode Theme Picker modal (Ctrl+X t or /theme)
 */
export function renderThemePickerModal(model: OpenCodeModel): string {
  const theme = model.theme;
  const state = model.modalState || { selectedIndex: 0 };
  const selectedIndex = state.selectedIndex || 0;

  const themeKeys = Object.keys(THEMES);
  const header = chalk.bold.hex(theme.primary)("OpenCode Theme Selector");

  const items = themeKeys.map((key, idx) => {
    const th = THEMES[key];
    const isSelected = idx === selectedIndex;
    const isCurrent = th.name === theme.name;
    const marker = isSelected ? chalk.hex(theme.primary)("❯ ") : "  ";
    const currentTag = isCurrent ? chalk.dim(" (active)") : "";
    const name = isSelected ? chalk.bold.white(th.displayName) : chalk.white(th.displayName);
    const dots = `${chalk.hex(th.primary)("●")} ${chalk.hex(th.secondary)("●")} ${chalk.hex(th.success)("●")}`;
    return `${marker}${dots} ${name}${currentTag}`;
  });

  const footer = chalk.dim("↑/↓: navigate • Enter: apply • Esc: cancel");
  const content = `${header}\n\n${items.join("\n")}\n\n${footer}`;

  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 4, right: 4 },
    borderStyle: "round",
    borderColor: theme.primary as any,
  });
}

/**
 * Renders OpenCode Session Switcher modal (Ctrl+X l or /sessions)
 */
export function renderSessionSwitcherModal(model: OpenCodeModel): string {
  const theme = model.theme;
  const state = model.modalState || { selectedIndex: 0 };
  const selectedIndex = state.selectedIndex || 0;

  const header = chalk.bold.hex(theme.primary)("OpenCode Session Switcher (Ctrl+X l)");

  const items = model.sessions.map((sess, idx) => {
    const isSelected = idx === selectedIndex;
    const isCurrent = sess.id === model.activeSessionId;
    const marker = isSelected ? chalk.hex(theme.primary)("❯ ") : "  ";
    const activeBadge = isCurrent ? chalk.green(" [Active]") : "";
    const title = isSelected ? chalk.bold.white(sess.title) : chalk.white(sess.title);
    return `${marker}${idx + 1}: ${title}${activeBadge}`;
  });

  const newOptionIndex = model.sessions.length;
  const isNewSelected = selectedIndex === newOptionIndex;
  const newMarker = isNewSelected ? chalk.hex(theme.primary)("❯ ") : "  ";
  const newTab = `${newMarker}${chalk.bold.green("+ Start New Fresh Session (n)")}`;

  const footer = chalk.dim("↑/↓: select • Enter: switch • n: new • Esc: dismiss");
  const content = `${header}\n\n${items.join("\n")}\n${newTab}\n\n${footer}`;

  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 4, right: 4 },
    borderStyle: "round",
    borderColor: theme.primary as any,
  });
}
