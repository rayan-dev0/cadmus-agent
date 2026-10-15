import boxen from "boxen";
import chalk from "chalk";
import { highlight } from "cli-highlight";

/**
 * Formats a code block with language syntax highlighting inside a rounded box
 */
export function formatCodeBlock(code: string, language?: string): string {
  let highlighted = code;
  try {
    if (language && language !== "text") {
      highlighted = highlight(code, { language, ignoreIllegals: true });
    } else {
      highlighted = highlight(code, { ignoreIllegals: true });
    }
  } catch {
    highlighted = code;
  }

  const title = language ? chalk.bold.cyan(` ${language} `) : "";

  return boxen(highlighted, {
    title,
    titleAlignment: "left",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "gray",
  });
}

/**
 * Formats markdown response text for beautiful terminal display
 */
export function renderTerminalMarkdown(markdown: string): string {
  // Replace code fences ```lang\ncode\n```
  const codeFenceRegex = /```([a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g;
  let formatted = markdown.replace(codeFenceRegex, (_, lang, code) => {
    return `\n${formatCodeBlock(code.trimEnd(), lang || "typescript")}\n`;
  });

  // Highlight inline code `text`
  formatted = formatted.replace(/`([^`]+)`/g, (_, code) => {
    return chalk.cyan(` ${code} `);
  });

  // Style headers
  formatted = formatted.replace(/^### (.*$)/gm, (_, text) => chalk.bold.cyan(`◆ ${text}`));
  formatted = formatted.replace(/^## (.*$)/gm, (_, text) => chalk.bold.hex("#7928CA")(`■ ${text}`));
  formatted = formatted.replace(/^# (.*$)/gm, (_, text) => chalk.bold.hex("#00DFD8")(`\n=== ${text.toUpperCase()} ===\n`));

  return formatted;
}
