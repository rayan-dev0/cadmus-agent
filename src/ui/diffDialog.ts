import boxen from "boxen";
import chalk from "chalk";
import { select } from "@clack/prompts";
import { formatTerminalDiff } from "../tools/diffViewer.js";

export type DiffDecision = "accept" | "reject" | "always";

export interface DiffApprovalOptions {
  filePath: string;
  patch: string;
  additions: number;
  deletions: number;
}

/**
 * Prompts the user with an interactive boxed diff dialog
 */
export async function promptDiffApproval(options: DiffApprovalOptions): Promise<DiffDecision> {
  const { filePath, patch, additions, deletions } = options;

  const header = `${chalk.bold.yellow("MODIFIED FILE:")} ${chalk.bold.white(filePath)}  ` +
    `${chalk.green(`+${additions}`)} ${chalk.red(`-${deletions}`)}`;

  const formattedPatch = formatTerminalDiff(patch);
  const diffBox = boxen(`${header}\n\n${formattedPatch}`, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "yellow",
  });

  console.log(diffBox);

  if (!process.stdin.isTTY) {
    return "accept";
  }

  try {
    const decision = await select({
      message: `Review changes for ${filePath}:`,
      options: [
        { value: "accept", label: `${chalk.green("✓ Accept Changes")}`, hint: "Apply patch to disk" },
        { value: "reject", label: `${chalk.red("✗ Reject Changes")}`, hint: "Discard modifications" },
        { value: "always", label: `${chalk.cyan("⚡ Accept & Auto-Approve Edits")}`, hint: "Allow all edits this session" },
      ],
    });

    if (typeof decision === "symbol" || !decision) {
      return "reject";
    }

    return decision as DiffDecision;
  } catch {
    return "reject";
  }
}
