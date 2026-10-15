import boxen from "boxen";
import chalk from "chalk";
import { getCurrentTheme } from "./themes.js";
import { formatTerminalDiff } from "../tools/diffViewer.js";

export interface ToolCardOptions {
  toolName: string;
  arguments: any;
  output: string;
  success: boolean;
  durationMs?: number;
  showDetails?: boolean;
}

/**
 * Renders an OpenCode-style tool execution card
 */
export function formatToolCard(options: ToolCardOptions): string {
  const { toolName, arguments: args, output, success, durationMs, showDetails = false } = options;
  const theme = getCurrentTheme();

  const glyph = success ? chalk.hex(theme.success)("✓") : chalk.hex(theme.error)("✗");
  const timeBadge = durationMs !== undefined ? chalk.dim(` [${durationMs}ms]`) : "";
  const title = `${glyph} Tool: ${chalk.bold.hex(theme.primary)(toolName)}${timeBadge}`;

  // Concise 1-line summary view
  if (!showDetails) {
    let summaryText = "";
    if (toolName === "read_file") {
      summaryText = `Reading ${args?.path || ""}`;
    } else if (toolName === "edit_file") {
      summaryText = `Modifying ${args?.path || ""}`;
    } else if (toolName === "run_terminal_command") {
      summaryText = `Shell: ${args?.command || ""}`;
    } else if (toolName === "grep_search") {
      summaryText = `Grep "${args?.query || ""}"`;
    } else if (toolName === "file_search") {
      summaryText = `Search "${args?.pattern || ""}"`;
    } else if (toolName === "codebase_search") {
      summaryText = `Semantic search "${args?.query || ""}"`;
    } else if (toolName === "list_dir") {
      summaryText = `List folder ${args?.path || "."}`;
    } else {
      summaryText = `Executed ${toolName}`;
    }

    const cardContent = `${glyph} ${chalk.bold.white(toolName)}: ${chalk.cyan(summaryText)}${timeBadge}`;

    return boxen(cardContent, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: success ? (theme.primary as any) : "red",
    });
  }

  // Expanded detailed view (Ctrl+X d / /details)
  let body = "";
  if (toolName === "edit_file" && output.includes("@@")) {
    body = formatTerminalDiff(output);
  } else {
    const rawPreview = output.length > 800 ? `${output.slice(0, 800)}\n... (truncated)` : output;
    body = `${chalk.dim("Params:")} ${JSON.stringify(args)}\n\n${chalk.dim("Output:")}\n${rawPreview}`;
  }

  return boxen(`${chalk.bold(title)}\n\n${body}`, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: success ? (theme.primary as any) : "red",
  });
}
