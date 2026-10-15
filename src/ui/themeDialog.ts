import chalk from "chalk";
import { select } from "@clack/prompts";
import { THEMES, setTheme, getCurrentTheme } from "./themes.js";
import { showToast } from "./toast.js";

/**
 * Interactive OpenCode Theme Picker Modal (/theme or Ctrl+X t)
 */
export async function runThemeDialog(workspaceRoot: string = process.cwd()): Promise<string> {
  const active = getCurrentTheme();

  const options = Object.values(THEMES).map((th) => {
    const isCurrent = th.name === active.name;
    const swatch = `${chalk.hex(th.primary)("■")} ${chalk.hex(th.secondary)("■")} ${chalk.hex(th.success)("■")} ${chalk.hex(th.warning)("■")}`;
    const marker = isCurrent ? chalk.bold.green(" (Active)") : "";

    return {
      value: th.name,
      label: `${th.displayName}${marker}`,
      hint: `${swatch}  ${th.name}`,
    };
  });

  const choice = await select({
    message: "Select an OpenCode Interface Theme:",
    options,
  });

  if (typeof choice === "symbol" || !choice) {
    return active.name;
  }

  const selectedTheme = setTheme(choice as string, workspaceRoot);
  showToast(
    "success",
    "Theme Updated",
    `Switched to ${selectedTheme.displayName} (saved to .agent/tui.json)`
  );

  return selectedTheme.name;
}
