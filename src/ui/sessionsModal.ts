import chalk from "chalk";
import { select } from "@clack/prompts";
import { getDb } from "../db/database.js";
import { showToast } from "./toast.js";

export interface SessionRecord {
  id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
  message_count?: number;
}

export function listSessionsFromDb(dbPath?: string): SessionRecord[] {
  const db = getDb(dbPath);
  const rows: any[] = db.prepare(`
    SELECT s.id, s.title, s.model, s.created_at, s.updated_at,
           COUNT(m.id) as message_count
    FROM sessions s
    LEFT JOIN messages m ON s.id = m.session_id
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT 20
  `).all();

  return rows;
}

/**
 * Interactive OpenCode Session Switcher Dialog (Ctrl+X l or /sessions)
 */
export async function runSessionsDialog(
  dbPath: string | undefined,
  currentSessionId: string
): Promise<{ action: "switch" | "new" | "stay"; sessionId?: string }> {
  const sessions = listSessionsFromDb(dbPath);

  const options: Array<{ value: string; label: string; hint?: string }> = [
    {
      value: "__NEW__",
      label: chalk.green.bold("+ Start New Session (Ctrl+X n)"),
      hint: "Create fresh conversation",
    },
  ];

  for (const s of sessions) {
    const isCurrent = s.id === currentSessionId;
    const title = s.title || `Session ${s.id.slice(0, 8)}`;
    const marker = isCurrent ? chalk.bold.green(" (Active)") : "";
    const dateStr = new Date(s.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    options.push({
      value: s.id,
      label: `${title}${marker}`,
      hint: `${s.model} • ${s.message_count || 0} msgs • ${dateStr}`,
    });
  }

  options.push({
    value: "__CANCEL__",
    label: chalk.dim("← Return to current session"),
  });

  const choice = await select({
    message: "OpenCode Session Switcher (Ctrl+X l):",
    options,
  });

  if (choice === "__CANCEL__" || typeof choice === "symbol" || !choice) {
    return { action: "stay" };
  }

  if (choice === "__NEW__") {
    return { action: "new" };
  }

  if (choice === currentSessionId) {
    return { action: "stay" };
  }

  showToast("info", "Switched Session", `Active session changed to ${choice.slice(0, 8)}`);
  return { action: "switch", sessionId: choice as string };
}
