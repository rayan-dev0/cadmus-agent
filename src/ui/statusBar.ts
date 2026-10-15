import boxen from "boxen";
import chalk from "chalk";
import { AgentMode } from "../agent/modes.js";
import { getCurrentTheme } from "./themes.js";

export interface StatusBarProps {
  mode: AgentMode;
  model: string;
  gitBranch: string;
  totalChunks: number;
  leaderActive?: boolean;
  showDetails?: boolean;
}

/**
 * Formats OpenCode-style horizontal bottom status bar
 */
export function formatStatusBar(props: StatusBarProps): string {
  const { mode, model, gitBranch, totalChunks, leaderActive = false, showDetails = false } = props;
  const theme = getCurrentTheme();

  const modeBadge =
    mode === "BUILD"
      ? chalk.bgHex(theme.success).hex(theme.badgeFg).bold(" BUILD MODE ")
      : chalk.bgHex(theme.warning).hex(theme.badgeFg).bold(" PLAN MODE ");

  const leaderBadge = leaderActive
    ? chalk.bgHex(theme.warning).black.bold(" [^X LEADER (2s)] ") + " "
    : "";

  const detailsBadge = showDetails
    ? chalk.bgHex(theme.secondary).hex(theme.badgeFg).bold(" DETAILS ") + " "
    : "";

  const leftSection =
    `${leaderBadge}${detailsBadge}${modeBadge}  ` +
    `${chalk.dim("Model:")} ${chalk.hex(theme.primary).bold(model)}  ` +
    `${chalk.dim("Git:")} ${chalk.hex(theme.success)(gitBranch)}  ` +
    `${chalk.dim("Chunks:")} ${chalk.white(String(totalChunks))}`;

  const shortcuts = chalk.dim(
    "Ctrl+X: Leader • Ctrl+P: Palette • Tab: Mode • /: Commands • @: Attach"
  );

  const barContent = `${leftSection}\n${shortcuts}`;

  return boxen(barContent, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: "single",
    borderColor: mode === "BUILD" ? (theme.primary as any) : "yellow",
  });
}
