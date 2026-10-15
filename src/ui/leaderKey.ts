import chalk from "chalk";
import { select } from "@clack/prompts";
import { SLASH_COMMANDS } from "./commandCatalog.js";

export type LeaderAction =
  | "new_session"
  | "list_sessions"
  | "switch_model"
  | "compact_history"
  | "undo_turn"
  | "toggle_details"
  | "switch_theme"
  | "show_help"
  | "exit_agent"
  | "command_palette";

export class LeaderKeyManager {
  private isLeaderActive = false;
  private leaderTimer: NodeJS.Timeout | null = null;
  public readonly timeoutMs = 2000;

  get isActive(): boolean {
    return this.isLeaderActive;
  }

  startLeader(onExpire?: () => void): void {
    this.cancelLeader();
    this.isLeaderActive = true;
    this.leaderTimer = setTimeout(() => {
      this.isLeaderActive = false;
      this.leaderTimer = null;
      onExpire?.();
    }, this.timeoutMs);
  }

  cancelLeader(): void {
    if (this.leaderTimer) {
      clearTimeout(this.leaderTimer);
      this.leaderTimer = null;
    }
    this.isLeaderActive = false;
  }

  handleKey(
    key: { ctrl?: boolean; name?: string; sequence?: string },
    onExpire?: () => void
  ): {
    handled: boolean;
    action?: LeaderAction;
    statusText?: string;
  } {
    // Global Command Palette: Ctrl+P
    if (key.ctrl && key.name === "p") {
      this.cancelLeader();
      return { handled: true, action: "command_palette" };
    }

    // Leader Key Trigger: Ctrl+X
    if (key.ctrl && key.name === "x") {
      this.startLeader(onExpire);
      return {
        handled: true,
        statusText: chalk.bgYellow.black.bold(" [^X LEADER (2s)] ") + " Press key: [n]ew [l]ist [m]odel [c]ompact [u]ndo [d]etails [t]heme [h]elp [q]uit",
      };
    }

    // Leader sequence follow-up key
    if (this.isLeaderActive && key.name) {
      const k = key.name.toLowerCase();
      this.cancelLeader();

      switch (k) {
        case "n":
          return { handled: true, action: "new_session" };
        case "l":
          return { handled: true, action: "list_sessions" };
        case "m":
          return { handled: true, action: "switch_model" };
        case "c":
          return { handled: true, action: "compact_history" };
        case "u":
          return { handled: true, action: "undo_turn" };
        case "d":
          return { handled: true, action: "toggle_details" };
        case "t":
          return { handled: true, action: "switch_theme" };
        case "h":
          return { handled: true, action: "show_help" };
        case "q":
          return { handled: true, action: "exit_agent" };
        case "escape":
          return { handled: true };
        default:
          return { handled: false };
      }
    }

    return { handled: false };
  }
}

/**
 * OpenCode Global Command Palette (Ctrl+P)
 */
export async function runCommandPalette(): Promise<string | null> {
  const options = [
    { value: "/mode", label: `${chalk.bold.cyan("/mode")} — Toggle BUILD vs PLAN mode`, hint: "Tab" },
    { value: "/compact", label: `${chalk.bold.cyan("/compact")} — Compress conversation context`, hint: "Ctrl+X c" },
    { value: "/connect", label: `${chalk.bold.cyan("/connect")} — Manage API credentials (.env)`, hint: "/connect" },
    { value: "/undo", label: `${chalk.bold.cyan("/undo")} — Rollback last turn and file changes`, hint: "Ctrl+X u" },
    { value: "/sessions", label: `${chalk.bold.cyan("/sessions")} — Switch or view session tabs`, hint: "Ctrl+X l" },
    { value: "/models", label: `${chalk.bold.cyan("/models")} — Browse curated and local models`, hint: "Ctrl+X m" },
    { value: "/theme", label: `${chalk.bold.cyan("/theme")} — Switch interface color theme`, hint: "Ctrl+X t" },
    { value: "/details", label: `${chalk.bold.cyan("/details")} — Toggle tool execution details`, hint: "Ctrl+X d" },
    { value: "/index", label: `${chalk.bold.cyan("/index")} — Scan workspace into SQLite hybrid search`, hint: "/index" },
    { value: "/status", label: `${chalk.bold.cyan("/status")} — System, DB, and Ripgrep status`, hint: "/status" },
    { value: "/clear", label: `${chalk.bold.cyan("/clear")} — Start a fresh new session`, hint: "Ctrl+X n" },
    { value: "/help", label: `${chalk.bold.cyan("/help")} — Show command and shortcut guide`, hint: "Ctrl+X h" },
    { value: "/exit", label: `${chalk.bold.red("/exit")} — Exit agent`, hint: "Ctrl+X q" },
  ];

  const choice = await select({
    message: chalk.bold.cyan("OpenCode Command Palette (Ctrl+P):"),
    options,
  });

  if (typeof choice === "symbol" || !choice) {
    return null;
  }

  return choice as string;
}
