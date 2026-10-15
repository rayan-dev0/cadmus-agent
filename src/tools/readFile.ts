import fs from "node:fs";
import { z } from "zod";
import { ToolDefinition, ToolContext } from "./types.js";
import { resolveWorkspacePath, toPosixPath } from "../utils/os.js";

export const ReadFileSchema = z.object({
  path: z.string().describe("Relative or absolute path to the file to read"),
  start_line: z.number().int().positive().optional().describe("1-indexed starting line number (inclusive)"),
  end_line: z.number().int().positive().optional().describe("1-indexed ending line number (inclusive)"),
});

export type ReadFileParams = z.infer<typeof ReadFileSchema>;

export const readFileTool: ToolDefinition<ReadFileParams, string> = {
  name: "read_file",
  description: "Reads the contents of a specific file in the repository without needing to open it in a separate editor tab. Supports line windowing.",
  parameters: ReadFileSchema,
  jsonSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative or absolute path to the file to read" },
      start_line: { type: "integer", description: "1-indexed starting line number (inclusive)" },
      end_line: { type: "integer", description: "1-indexed ending line number (inclusive)" },
    },
    required: ["path"],
  },
  requiresConfirmation: false,
  execute: async (params, context: ToolContext) => {
    const fullPath = resolveWorkspacePath(context.workspaceRoot, params.path);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${params.path}`);
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${params.path}`);
    }

    // Limit single file read to 10MB to avoid memory exhaustion
    if (stat.size > 10 * 1024 * 1024) {
      throw new Error(`File is too large to read entirely (${(stat.size / (1024 * 1024)).toFixed(2)} MB). Use line range.`);
    }

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    const startLine = params.start_line ? Math.max(1, params.start_line) : 1;
    const endLine = params.end_line ? Math.min(totalLines, params.end_line) : Math.min(totalLines, startLine + 400);

    const slice = lines.slice(startLine - 1, endLine);
    const padLength = String(endLine).length;

    const formatted = slice
      .map((line, idx) => {
        const lineNum = String(startLine + idx).padStart(padLength, " ");
        return `${lineNum} | ${line}`;
      })
      .join("\n");

    const header = `[File: ${toPosixPath(params.path)} (Showing lines ${startLine}-${endLine} of ${totalLines})]`;
    return `${header}\n${formatted}`;
  },
};
