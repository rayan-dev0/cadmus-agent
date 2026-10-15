import boxen from "boxen";
import chalk from "chalk";

export interface DialogOptions {
  title: string;
  body: string;
  borderColor?: string;
  footer?: string;
}

/**
 * Renders a structured modal dialog box
 */
export function formatDialog(options: DialogOptions): string {
  const { title, body, borderColor = "magenta", footer } = options;

  let content = `${chalk.bold.cyan(title)}\n\n${body}`;
  if (footer) {
    content += `\n\n${chalk.dim("───────────────────────────────────────")}\n${chalk.dim(footer)}`;
  }

  return boxen(content, {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: "double",
    borderColor: borderColor as any,
  });
}
