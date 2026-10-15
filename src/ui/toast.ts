import boxen from "boxen";
import chalk from "chalk";

export type ToastType = "success" | "info" | "warning" | "error";

export interface ToastOptions {
  type: ToastType;
  title: string;
  message?: string;
}

/**
 * Renders an OpenCode-style boxed transient toast notification
 */
export function formatToast(options: ToastOptions): string {
  const { type, title, message } = options;

  let badge = "";
  let borderColor = "cyan";

  switch (type) {
    case "success":
      badge = chalk.bgGreen.black.bold(" ✓ SUCCESS ");
      borderColor = "green";
      break;
    case "warning":
      badge = chalk.bgYellow.black.bold(" ⚠ WARNING ");
      borderColor = "yellow";
      break;
    case "error":
      badge = chalk.bgRed.white.bold(" ✖ ERROR ");
      borderColor = "red";
      break;
    case "info":
    default:
      badge = chalk.bgCyan.black.bold(" ℹ INFO ");
      borderColor = "cyan";
      break;
  }

  const header = `${badge} ${chalk.bold.white(title)}`;
  const body = message ? `\n${chalk.dim(message)}` : "";
  const content = `${header}${body}`;

  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: borderColor as any,
  });
}

/**
 * Displays a toast notification in the terminal
 */
export function showToast(type: ToastType, title: string, message?: string): void {
  console.log(formatToast({ type, title, message }));
}
