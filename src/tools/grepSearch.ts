import { spawnSync } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { ToolDefinition, ToolContext } from "./types.js";
import { resolveWorkspacePath, toPosixPath } from "../utils/os.js";
import { resolveRipgrepPath } from "../utils/prereqs.js";

export const GrepSearchSchema = z.object({
  query: z.string().describe("Regular expression or literal search string to find across files"),
  path: z.string().optional().describe("Subdirectory or specific file to search in (defaults to workspace root)"),
  case_sensitive: z.boolean().optional().describe("Whether the search should be case sensitive (default: false)"),
  includes: z.string().optional().describe("File pattern to include (e.g. '*.ts', '*.py')"),
  max_results: z.number().int().positive().optional().describe("Maximum number of matching lines to return (default: 50)"),
});

export type GrepSearchParams = z.infer<typeof GrepSearchSchema>;

export const grepSearchTool: ToolDefinition<GrepSearchParams, string> = {
  name: "grep_search",
  description: "Runs regex-based text searches across files using native ripgrep for debugging and locating specific strings or syntax.",
  parameters: GrepSearchSchema,
  jsonSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Regular expression or literal search string to find across files" },
      path: { type: "string", description: "Subdirectory or file to search in" },
      case_sensitive: { type: "boolean", description: "Whether search is case sensitive" },
      includes: { type: "string", description: "File pattern to include (e.g. '*.ts')" },
      max_results: { type: "integer", description: "Maximum matching lines to return (default: 50)" },
    },
    required: ["query"],
  },
  requiresConfirmation: false,
  execute: async (params, context: ToolContext) => {
    const { path: rgExecutable } = resolveRipgrepPath();
    const searchTarget = params.path
      ? resolveWorkspacePath(context.workspaceRoot, params.path)
      : context.workspaceRoot;

    const maxResults = params.max_results ?? 50;

    const args = [
      "-n", // show line numbers
      "--no-heading",
      "--color=never",
      "--max-count", String(maxResults),
      "-g", "!node_modules/**",
      "-g", "!.git/**",
      "-g", "!dist/**",
      "-g", "!.agent/**",
    ];

    if (!params.case_sensitive) {
      args.push("-i");
    }

    if (params.includes) {
      args.push("-g", params.includes);
    }

    // Pass query and target path
    args.push("-e", params.query, searchTarget);

    const proc = spawnSync(rgExecutable, args, {
      cwd: context.workspaceRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });

    if (proc.error) {
      throw new Error(`Ripgrep execution failed: ${proc.error.message}`);
    }

    const stdout = proc.stdout ? proc.stdout.trim() : "";
    if (!stdout) {
      return `No matches found for "${params.query}"`;
    }

    const lines = stdout.split(/\r?\n/);
    const formattedMatches: string[] = [];

    for (const line of lines.slice(0, maxResults)) {
      // rg format: filepath:linenumber:linecontent
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match) {
        const [, filePath, lineNo, content] = match;
        const relPath = toPosixPath(path.relative(context.workspaceRoot, filePath));
        formattedMatches.push(`${relPath}:${lineNo} | ${content.trim()}`);
      } else {
        formattedMatches.push(line);
      }
    }

    const header = `Found ${lines.length} match(es) for "${params.query}" (showing top ${formattedMatches.length}):`;
    return `${header}\n${formattedMatches.join("\n")}`;
  },
};
