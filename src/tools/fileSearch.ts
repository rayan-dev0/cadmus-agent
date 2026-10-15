import { z } from "zod";
import fg from "fast-glob";
import { ToolDefinition, ToolContext } from "./types.js";
import { resolveWorkspacePath, toPosixPath } from "../utils/os.js";

export const FileSearchSchema = z.object({
  pattern: z.string().describe("Glob pattern or substring to match file names (e.g. '*.ts', '*agent*', 'database')"),
  path: z.string().optional().describe("Subdirectory to search in (defaults to workspace root)"),
  limit: z.number().int().positive().optional().describe("Maximum number of files to return (default: 50)"),
});

export type FileSearchParams = z.infer<typeof FileSearchSchema>;

export const fileSearchTool: ToolDefinition<FileSearchParams, string> = {
  name: "file_search",
  description: "Searches and locates files by name or glob pattern across the project.",
  parameters: FileSearchSchema,
  jsonSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern or substring to match file names" },
      path: { type: "string", description: "Subdirectory to search in" },
      limit: { type: "integer", description: "Maximum number of files to return (default: 50)" },
    },
    required: ["pattern"],
  },
  requiresConfirmation: false,
  execute: async (params, context: ToolContext) => {
    const searchRoot = params.path
      ? resolveWorkspacePath(context.workspaceRoot, params.path)
      : context.workspaceRoot;

    // Convert simple substring search to a glob pattern if not already a glob
    let globPattern = params.pattern;
    if (!globPattern.includes("*") && !globPattern.includes("?")) {
      globPattern = `**/*${globPattern}*`;
    } else if (!globPattern.startsWith("**/")) {
      globPattern = `**/${globPattern}`;
    }

    const matches = await fg(globPattern, {
      cwd: searchRoot,
      ignore: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/.agent/**",
        "**/.next/**",
      ],
      dot: false,
      onlyFiles: false,
    });

    const limit = params.limit ?? 50;
    const sliced = matches.slice(0, limit).map(toPosixPath);

    if (sliced.length === 0) {
      return `No files found matching pattern: "${params.pattern}"`;
    }

    const header = `Found ${matches.length} matching file(s) (showing top ${sliced.length}):`;
    return `${header}\n${sliced.map((f) => `- ${f}`).join("\n")}`;
  },
};
