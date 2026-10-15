import chalk from "chalk";
import boxen from "boxen";
import { OpenCodeModel } from "./model.js";
import { formatSessionTabs } from "../sessionTabs.js";
import { formatHeaderBar } from "../headerBar.js";
import { formatStatusBar } from "../statusBar.js";
import { renderViewportLines, stripAnsi } from "./viewport.js";
import {
  renderDiffModal,
  renderConfirmModal,
  renderCommandPaletteModal,
  renderLeaderKeyModal,
  renderThemePickerModal,
  renderSessionSwitcherModal,
} from "./modals.js";

/**
 * Renders the floating autocomplete popover box
 */
function renderAutocompletePopover(model: OpenCodeModel): string[] {
  if (!model.isAutocompleteOpen || model.suggestions.length === 0) {
    return [];
  }

  const theme = model.theme;
  const maxDisplay = 5;
  const items = model.suggestions.slice(0, maxDisplay);

  const lines = items.map((item, idx) => {
    const isSelected = idx === model.selectedSuggestionIndex;
    const marker = isSelected ? chalk.hex(theme.primary)("❯ ") : "  ";
    const name = isSelected ? chalk.bold.hex(theme.primary)(item.name) : chalk.white(item.name);
    const desc = chalk.dim(` ${item.description}`);
    const tag = chalk.hex(theme.secondary)(` [${item.category}]`);
    return `${marker}${name}${tag}${desc}`;
  });

  const box = boxen(lines.join("\n"), {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: theme.primary as any,
  });

  return box.split("\n");
}

/**
 * Main view renderer for OpenCode Bubble Tea TUI
 */
export function renderOpenCodeView(model: OpenCodeModel): string {
  const theme = model.theme;

  // 1. Top Chrome: Session Tabs & Header Bar
  const sessionTabsStr = formatSessionTabs(model.sessions);
  const headerBarStr = formatHeaderBar({
    workspaceName: model.workspaceName,
    model: model.modelName,
    gitBranch: model.gitBranch,
    gitDirty: model.gitDirty,
    totalTokens: model.tokenCount,
    maxTokens: model.maxTokens,
  });

  const topLines = [...sessionTabsStr.split("\n"), ...headerBarStr.split("\n")];

  // 2. Bottom Chrome: Status Bar & Input Prompt
  const statusBarStr = formatStatusBar({
    mode: model.mode,
    model: model.modelName,
    gitBranch: model.gitBranch,
    totalChunks: model.totalChunks,
    leaderActive: model.activeModal === "LEADER_KEY",
    showDetails: model.showDetails,
  });

  // Render input prompt with inline cursor
  const promptLabel =
    model.mode === "BUILD"
      ? chalk.bold.hex(theme.success)("cadmus [BUILD] > ")
      : chalk.bold.hex(theme.warning)("cadmus [PLAN] > ");

  const beforeCursor = model.inputBuffer.slice(0, model.cursorPos);
  const charAtCursor = model.inputBuffer.slice(model.cursorPos, model.cursorPos + 1) || " ";
  const afterCursor = model.inputBuffer.slice(model.cursorPos + 1);
  const cursorElem = chalk.inverse(charAtCursor);
  const promptLine = `${promptLabel}${beforeCursor}${cursorElem}${afterCursor}`;

  const autocompleteLines = renderAutocompletePopover(model);

  // Active Toast notification line if present
  const toastLines: string[] = [];
  if (model.toast) {
    const toastBadge = chalk.bgHex(
      model.toast.type === "success"
        ? theme.success
        : model.toast.type === "error"
        ? theme.error
        : theme.warning
    ).black.bold(` ${model.toast.title}: `);
    toastLines.push(`${toastBadge} ${chalk.white(model.toast.message)}`);
  }

  const bottomLines = [
    ...toastLines,
    ...statusBarStr.split("\n"),
    ...autocompleteLines,
    promptLine,
  ];

  // 3. Middle Viewport: calculate available lines
  const fixedLinesCount = topLines.length + bottomLines.length;
  const viewportHeight = Math.max(4, model.termHeight - fixedLinesCount);

  // If a modal is active, display the modal centered inside the viewport area
  let centerLines: string[] = [];
  if (model.activeModal) {
    let modalBox = "";
    switch (model.activeModal) {
      case "DIFF_APPROVAL":
        modalBox = renderDiffModal(model);
        break;
      case "CONFIRMATION":
        modalBox = renderConfirmModal(model);
        break;
      case "COMMAND_PALETTE":
        modalBox = renderCommandPaletteModal(model);
        break;
      case "LEADER_KEY":
        modalBox = renderLeaderKeyModal(model);
        break;
      case "THEME_PICKER":
        modalBox = renderThemePickerModal(model);
        break;
      case "SESSION_SWITCHER":
        modalBox = renderSessionSwitcherModal(model);
        break;
      default:
        modalBox = "";
    }

    const modalLines = modalBox.split("\n");
    const padTop = Math.max(0, Math.floor((viewportHeight - modalLines.length) / 2));
    const padBottom = Math.max(0, viewportHeight - modalLines.length - padTop);

    for (let i = 0; i < padTop; i++) centerLines.push("");
    centerLines.push(...modalLines);
    for (let i = 0; i < padBottom; i++) centerLines.push("");
  } else {
    // Normal conversation viewport
    centerLines = renderViewportLines(model, viewportHeight);
  }

  // 4. Combine all slices
  return [...topLines, ...centerLines, ...bottomLines].join("\n");
}
