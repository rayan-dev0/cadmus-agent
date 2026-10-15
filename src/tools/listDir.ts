import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ToolDefinition, ToolContext } from "./types.js";
import { resolveWorkspacePath, toPosixPath } from "../utils/os.js";

export const ListDirSchema = z.object({
  path: z.string().optional().describe("Directory path to list (defaults to workspace root)"),
  depth: z.number().int().min(1).max(5).optional().describe("Maximum recursion depth (default: 2)"),
  show_hidden: z.boolean().optional().describe("Whether to include hidden files (default: false)"),
});

export type ListDirParams = z.infer<typeof ListDirSchema>;

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".agent", ".next", ".turbo"]);

export const listDirTool: ToolDefinition<ListDirParams, string> = {
  name: "list_dir",
  description: "Lists the contents and directory structure of folders to locate components and project layouts.",
  parameters: ListDirSchema,
  jsonSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path to list (defaults to workspace root)" },
      depth: { type: "integer", description: "Maximum recursion depth (default: 2)" },
      show_hidden: { type: "boolean", description: "Whether to include hidden files" },
    },
  },
  requiresConfirmation: false,
  execute: async (params, context: ToolContext) => {
    const targetDir = params.path
      ? resolveWorkspacePath(context.workspaceRoot, params.path)
      : context.workspaceRoot;

    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory not found: ${params.path || "."}`);
    }

    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      throw new Error(`Path is a file, not a directory: ${params.path}`);
    }

    const maxDepth = params.depth ?? 2;
    const showHidden = params.show_hidden ?? false;

    function renderTree(dir: string, currentDepth: number, prefix: string = ""): string[] {
      if (currentDepth > maxDepth) return [];
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return [];
      }

      // Filter entries
      const filtered = entries.filter((e) => {
        if (!showHidden && e.name.startsWith(".")) return false;
        if (e.isDirectory() && IGNORED_DIRS.has(e.name)) return false;
        return true;
      });

      // Sort: directories first, then alphabetical
      filtered.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      const lines: string[] = [];
      filtered.forEach((entry, idx) => {
        const isLast = idx === filtered.length - 1;
        const branch = isLast ? "└── " : "├── ";
        const childPrefix = prefix + (isLast ? "    " : "│   ");

        if (entry.isDirectory()) {
          lines.push(`${prefix}${branch}${entry.name}/`);
          lines.push(...renderTree(path.join(dir, entry.name), currentDepth + 1, childPrefix));
        } else {
          try {
            const fileStat = fs.statSync(path.join(dir, entry.name));
            const sizeStr = formatFileSize(fileStat.size);
            lines.push(`${prefix}${branch}${entry.name} (${sizeStr})`);
          } catch {
            lines.push(`${prefix}${branch}${entry.name}`);
          }
        }
      });

      return lines;
    }

    function formatFileSize(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    const relPath = toPosixPath(path.relative(context.workspaceRoot, targetDir)) || ".";
    const treeLines = renderTree(targetDir, 1);
    return `[Directory: ${relPath}]\n${treeLines.join("\n") || "(empty directory)"}`;
  },
};
