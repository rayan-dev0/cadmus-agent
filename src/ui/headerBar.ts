import boxen from "boxen";
import chalk from "chalk";
import { getCurrentTheme } from "./themes.js";

export interface HeaderBarProps {
  workspaceName: string;
  model: string;
  gitBranch: string;
  gitDirty?: boolean;
  totalTokens?: number;
  maxTokens?: number;
}

/**
 * Formats OpenCode's top persistent status & context meter header
 */
export function formatHeaderBar(props: HeaderBarProps): string {
  const {
    workspaceName,
    model,
    gitBranch,
    gitDirty = false,
    totalTokens = 1240,
    maxTokens = 200000,
  } = props;

  const theme = getCurrentTheme();

  const brandBadge = chalk.bgHex(theme.badgeBg).hex(theme.badgeFg).bold(" OpenCode TUI ");
  const projectLabel = `${chalk.dim("Project:")} ${chalk.bold.white(workspaceName)}`;
  const modelLabel = `${chalk.dim("Model:")} ${chalk.hex(theme.primary).bold(model)}`;

  const percent = ((totalTokens / maxTokens) * 100).toFixed(1);
  const tokenMeter = `${chalk.dim("Context:")} ${chalk.white((totalTokens / 1000).toFixed(1))}k/${(maxTokens / 1000).toFixed(0)}k ${chalk.hex(theme.warning)(`(${percent}%)`)}`;

  const branchMarker = gitDirty ? chalk.yellow(`${gitBranch}*`) : chalk.green(gitBranch);
  const gitLabel = `${chalk.dim("Git:")} ${branchMarker}`;

  const themeLabel = `${chalk.dim("Theme:")} ${chalk.hex(theme.secondary)(theme.name)}`;

  const line1 = `${brandBadge}  ${projectLabel}  │  ${modelLabel}  │  ${tokenMeter}  │  ${gitLabel}  │  ${themeLabel}`;

  return boxen(line1, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    borderStyle: "single",
    borderColor: "gray",
  });
}
