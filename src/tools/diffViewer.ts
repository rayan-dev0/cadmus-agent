import { createTwoFilesPatch } from "diff";
import chalk from "chalk";

export interface DiffResult {
  patch: string;
  hasChanges: boolean;
  additions: number;
  deletions: number;
}

/**
 * Computes a unified diff between original and modified text
 */
export function generateDiff(filePath: string, originalContent: string, newContent: string): DiffResult {
  const patch = createTwoFilesPatch(
    `a/${filePath}`,
    `b/${filePath}`,
    originalContent,
    newContent,
    "",
    "",
    { context: 3 }
  );

  let additions = 0;
  let deletions = 0;

  const lines = patch.split("\n");
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }

  return {
    patch,
    hasChanges: additions > 0 || deletions > 0,
    additions,
    deletions,
  };
}

/**
 * Formats a unified diff with chalk colors for terminal display
 */
export function formatTerminalDiff(patch: string): string {
  const lines = patch.split("\n");
  const formattedLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      formattedLines.push(chalk.bold.gray(line));
    } else if (line.startsWith("@@")) {
      formattedLines.push(chalk.cyan(line));
    } else if (line.startsWith("+")) {
      formattedLines.push(chalk.green(line));
    } else if (line.startsWith("-")) {
      formattedLines.push(chalk.red(line));
    } else {
      formattedLines.push(chalk.dim(line));
    }
  }

  return formattedLines.join("\n");
}
