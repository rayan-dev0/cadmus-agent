import { getWorkspaceFiles } from "./workspaceFiles.js";

export interface CommandItem {
  name: string;
  description: string;
  category: "Mode" | "Session" | "Models" | "Database" | "System" | "Attachment";
  requiresArgs: boolean;
  sampleArgs?: string;
}

export const SLASH_COMMANDS: CommandItem[] = [
  {
    name: "/mode",
    description: "Toggle between BUILD (write) & PLAN (safe read-only) modes",
    category: "Mode",
    requiresArgs: false,
  },
  {
    name: "/compact",
    description: "Compact past turns into concise architectural summary",
    category: "Session",
    requiresArgs: false,
  },
  {
    name: "/connect",
    description: "Open interactive API key manager (OpenRouter, Claude, GPT)",
    category: "System",
    requiresArgs: false,
  },
  {
    name: "/models",
    description: "Browse curated models catalog (Ollama, AirLLM, Cloud)",
    category: "Models",
    requiresArgs: false,
  },
  {
    name: "/models openrouter",
    description: "Browse OpenRouter live cloud model registry",
    category: "Models",
    requiresArgs: false,
  },
  {
    name: "/models search",
    description: "Search live Hugging Face model repository",
    category: "Models",
    requiresArgs: true,
    sampleArgs: "<query>",
  },
  {
    name: "/pull",
    description: "1-click download/pull a model directly with progress",
    category: "Models",
    requiresArgs: true,
    sampleArgs: "<model-name>",
  },
  {
    name: "/local",
    description: "Scan running local LLMs (Ollama, LM Studio, AirLLM)",
    category: "Models",
    requiresArgs: false,
  },
  {
    name: "/model",
    description: "Switch active LLM model (e.g. /model openrouter/deepseek/deepseek-r1)",
    category: "Models",
    requiresArgs: true,
    sampleArgs: "<model-name>",
  },
  {
    name: "/index",
    description: "Scan and index workspace into SQLite for hybrid search",
    category: "Database",
    requiresArgs: false,
  },
  {
    name: "/status",
    description: "Show OS, shell, ripgrep, and SQLite chunk stats",
    category: "System",
    requiresArgs: false,
  },
  {
    name: "/theme",
    description: "Switch interface color theme (tokyonight, catppuccin, nord)",
    category: "System",
    requiresArgs: false,
  },
  {
    name: "/sessions",
    description: "Switch or view session tabs (Ctrl+X l)",
    category: "Session",
    requiresArgs: false,
  },
  {
    name: "/undo",
    description: "Rollback file edits and conversation from last turn (Ctrl+X u)",
    category: "Session",
    requiresArgs: false,
  },
  {
    name: "/details",
    description: "Toggle verbose tool execution details (Ctrl+X d)",
    category: "System",
    requiresArgs: false,
  },
  {
    name: "/clear",
    description: "Reset current conversation session (Ctrl+X n)",
    category: "Session",
    requiresArgs: false,
  },
  {
    name: "/help",
    description: "Show overview of all commands, tools, and shortcuts",
    category: "System",
    requiresArgs: false,
  },
  {
    name: "/exit",
    description: "Exit the agent (Ctrl+X q)",
    category: "System",
    requiresArgs: false,
  },
];

export const ATTACHMENTS: CommandItem[] = [
  {
    name: "@file",
    description: "Attach file contents or line window (e.g. @file auth.ts#10-30)",
    category: "Attachment",
    requiresArgs: true,
    sampleArgs: "<path>#start-end",
  },
  {
    name: "@folder",
    description: "Attach directory structure and file tree",
    category: "Attachment",
    requiresArgs: true,
    sampleArgs: "<dir>",
  },
  {
    name: "@git",
    description: "Attach current git branch, status, and uncommitted diff",
    category: "Attachment",
    requiresArgs: false,
  },
  {
    name: "@web",
    description: "Fetch web documentation and convert to markdown",
    category: "Attachment",
    requiresArgs: true,
    sampleArgs: "<url>",
  },
  {
    name: "@search",
    description: "Hybrid SQLite search for relevant code snippets",
    category: "Attachment",
    requiresArgs: true,
    sampleArgs: "<query>",
  },
];

/**
 * Filters commands or attachments matching the current prompt buffer
 */
export function filterSuggestions(
  buffer: string,
  workspaceRoot?: string,
  dbPath?: string
): CommandItem[] {
  const trimmed = buffer.trimStart();

  if (trimmed.startsWith("/")) {
    const query = trimmed.toLowerCase();
    return SLASH_COMMANDS.filter((cmd) => {
      return (
        cmd.name.toLowerCase().startsWith(query) ||
        query.startsWith(cmd.name.toLowerCase()) ||
        cmd.name.toLowerCase().includes(query.replace(/^\//, ""))
      );
    });
  }

  // Check for @ attachment in current word
  const atMatch = buffer.match(/@([a-zA-Z0-9_\-\.\/]*)$/);
  if (atMatch) {
    const rawTarget = atMatch[1].toLowerCase();
    const query = `@${rawTarget}`;

    // 1. Core attachments (@file, @folder, @git, @web, @search)
    const matchedStatic = ATTACHMENTS.filter((att) =>
      att.name.toLowerCase().startsWith(query)
    );

    // 2. Dynamic workspace files matching the query (only if workspaceRoot provided)
    let dynamicFiles: CommandItem[] = [];
    if (workspaceRoot) {
      try {
        const files = getWorkspaceFiles(workspaceRoot, dbPath);
        dynamicFiles = files
          .filter((f) => f.path.toLowerCase().includes(rawTarget))
          .slice(0, 10)
          .map((f) => ({
            name: `@${f.path}`,
            description: f.lineCount ? `File (${f.lineCount} lines)` : "Workspace File",
            category: "Attachment" as const,
            requiresArgs: false,
          }));
      } catch {
        // Ignore if dynamic scanner fails
      }
    }

    return [...matchedStatic, ...dynamicFiles];
  }

  return [];
}
