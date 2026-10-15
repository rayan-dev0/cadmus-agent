import { z } from "zod";
import { ToolDefinition, ToolContext } from "./types.js";
import { searchHybrid, CodeSearchResult } from "../db/search.js";
import { indexWorkspace } from "../db/indexer.js";
import { getDb } from "../db/database.js";

export const CodebaseSearchSchema = z.object({
  query: z.string().describe("Natural language query describing the function, pattern, or logic to find (e.g. 'JWT token validation', 'database connection retry')"),
  limit: z.number().int().positive().optional().describe("Maximum number of relevant code snippets to return (default: 8)"),
});

export type CodebaseSearchParams = z.infer<typeof CodebaseSearchSchema>;

export const codebaseSearchTool: ToolDefinition<CodebaseSearchParams, string> = {
  name: "codebase_search",
  description: "Performs semantic and hybrid search across the entire codebase in SQLite to find patterns, functions, and logic without needing exact keyword or file paths.",
  parameters: CodebaseSearchSchema,
  jsonSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural language query describing the function, pattern, or logic to find" },
      limit: { type: "integer", description: "Maximum number of relevant code snippets to return (default: 8)" },
    },
    required: ["query"],
  },
  requiresConfirmation: false,
  execute: async (params, context: ToolContext) => {
    const db = getDb(context.dbPath);

    // Check if codebase is already indexed
    const row: any = db.prepare("SELECT COUNT(*) as count FROM code_chunks").get();
    if (!row || row.count === 0) {
      // Auto-index if database is empty
      await indexWorkspace(context.workspaceRoot, context.dbPath);
    }

    const limit = params.limit ?? 8;
    const results = searchHybrid(params.query, undefined, limit, context.dbPath);

    if (results.length === 0) {
      return `No relevant code chunks found for semantic query: "${params.query}". Try a broader query or use grep_search for specific identifiers.`;
    }

    const formattedSnippets = results.map((res: CodeSearchResult, idx: number) => {
      const symbolInfo = res.symbolName ? ` [${res.symbolName}]` : "";
      return `--- Result #${idx + 1} (${res.matchType.toUpperCase()}) | ${res.filePath}:${res.startLine}-${res.endLine}${symbolInfo} ---\n${res.content}`;
    });

    const header = `Found ${results.length} relevant code snippet(s) for "${params.query}":`;
    return `${header}\n\n${formattedSnippets.join("\n\n")}`;
  },
};
