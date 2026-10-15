import chalk from "chalk";
import { OpenCodeModel, HistoryItem } from "./model.js";
import { formatToolCard } from "../toolCards.js";
import { renderTerminalMarkdown } from "../markdown.js";

/**
 * Strips ANSI escape codes from string to compute true character length
 */
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Wraps a line of text at word boundaries to fit within maxWidth
 */
export function wrapLine(line: string, maxWidth: number): string[] {
  if (maxWidth <= 10) return [line];
  const plain = stripAnsi(line);
  if (plain.length <= maxWidth) return [line];

  const words = line.split(" ");
  const result: string[] = [];
  let current = "";
  let currentLen = 0;

  for (const word of words) {
    const wordLen = stripAnsi(word).length;
    if (currentLen + wordLen + (currentLen > 0 ? 1 : 0) <= maxWidth) {
      current += (currentLen > 0 ? " " : "") + word;
      currentLen += wordLen + (currentLen > 0 ? 1 : 0);
    } else {
      if (current.length > 0) {
        result.push(current);
      }
      current = word;
      currentLen = wordLen;
    }
  }

  if (current.length > 0) {
    result.push(current);
  }

  return result.length > 0 ? result : [line];
}

/**
 * Formats conversation history entries into wrapped terminal lines
 */
export function formatHistoryLines(model: OpenCodeModel): string[] {
  const lines: string[] = [];
  const maxWidth = Math.max(20, model.termWidth - 4);
  const theme = model.theme;

  for (const item of model.history) {
    if (item.type === "user") {
      lines.push("");
      const userHeader = chalk.bold.hex(theme.primary)("❯ User:");
      const promptLines = item.text.split("\n");
      lines.push(`${userHeader} ${chalk.white.bold(promptLines[0] || "")}`);
      for (let i = 1; i < promptLines.length; i++) {
        lines.push(`  ${chalk.white(promptLines[i])}`);
      }
    } else if (item.type === "assistant") {
      lines.push("");
      const agentHeader = chalk.bold.hex(theme.secondary)("● OpenCode:");
      lines.push(agentHeader);

      const streamCursor = item.isStreaming ? chalk.hex(theme.primary).bold(" ▋") : "";
      const rawText = (item.text || "") + streamCursor;

      if (rawText.trim()) {
        const mdFormatted = renderTerminalMarkdown(rawText);
        const mdLines = mdFormatted.split("\n");
        for (const line of mdLines) {
          const wrapped = wrapLine(line, maxWidth);
          lines.push(...wrapped);
        }
      } else if (item.isStreaming) {
        lines.push(chalk.dim("  Thinking..."));
      }
    } else if (item.type === "tool") {
      lines.push("");
      const card = formatToolCard({
        ...item.options,
        showDetails: model.showDetails,
      });
      const cardLines = card.split("\n");
      lines.push(...cardLines);
    } else if (item.type === "system") {
      lines.push(chalk.dim(item.text));
    }
  }

  return lines;
}

/**
 * Calculates the visible slice of lines for the conversation viewport
 */
export function renderViewportLines(
  model: OpenCodeModel,
  viewportHeight: number
): string[] {
  const allLines = formatHistoryLines(model);
  const totalLines = allLines.length;

  if (totalLines <= viewportHeight) {
    // Pad empty lines if needed
    const padded = [...allLines];
    while (padded.length < viewportHeight) {
      padded.push("");
    }
    return padded;
  }

  // Calculate slice range based on viewportScrollOffset
  const maxOffset = totalLines - viewportHeight;
  const clampedOffset = Math.max(0, Math.min(model.viewportScrollOffset, maxOffset));

  const start = totalLines - viewportHeight - clampedOffset;
  const end = totalLines - clampedOffset;

  const visible = allLines.slice(start, end);

  // If scrolled up, add a subtle scroll position indicator on the first line
  if (clampedOffset > 0 && visible.length > 0) {
    const scrollBadge = chalk.bgHex(model.theme.warning).black.bold(
      ` [↑ Scrolled ${clampedOffset} lines above • PgDn to return] `
    );
    visible[0] = scrollBadge;
  }

  return visible;
}
