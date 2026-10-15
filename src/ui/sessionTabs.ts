import chalk from "chalk";
import boxen from "boxen";
import { getCurrentTheme } from "./themes.js";

export interface SessionTabInfo {
  id: string;
  title: string;
  isActive: boolean;
  messageCount?: number;
}

/**
 * Formats a Chrome-style tab bar matching OpenCode
 */
export function formatSessionTabs(tabs: SessionTabInfo[]): string {
  const theme = getCurrentTheme();

  const brand = chalk.bgHex(theme.badgeBg).hex(theme.badgeFg).bold(" Cadmus ");

  const renderedTabs = tabs.map((tab, idx) => {
    const num = idx + 1;
    const tabLabel = `${num}: ${tab.title || "Session"}`;
    if (tab.isActive) {
      return chalk.bgHex(theme.primary).hex(theme.badgeFg).bold(` ${tabLabel}* `);
    }
    return chalk.hex(theme.muted)(` ${tabLabel} `);
  });

  const newTabBtn = chalk.dim(" [+] New (Ctrl+X n) ");
  const content = `${brand}  ${renderedTabs.join(chalk.dim("│"))}  ${newTabBtn}`;

  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    borderStyle: "single",
    borderColor: "gray",
  });
}
