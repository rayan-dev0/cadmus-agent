import { ToolDefinition, ToolContext, ToolCallResult } from "./types.js";
import { readFileTool } from "./readFile.js";
import { editFileTool } from "./editFile.js";
import { listDirTool } from "./listDir.js";
import { fileSearchTool } from "./fileSearch.js";
import { grepSearchTool } from "./grepSearch.js";
import { codebaseSearchTool } from "./codebaseSearch.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.register(readFileTool);
    this.register(editFileTool);
    this.register(listDirTool);
    this.register(fileSearchTool);
    this.register(grepSearchTool);
    this.register(codebaseSearchTool);
    this.register(runTerminalCommandTool);
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Generates tool schemas for LLM provider API requests
   */
  getSchemas(): any[] {
    return this.getAll().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.jsonSchema,
      // For OpenAI format
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.jsonSchema,
      },
    }));
  }

  /**
   * Dispatches and executes a tool call with error recovery
   */
  async execute(name: string, callId: string, params: any, context: ToolContext): Promise<ToolCallResult> {
    const tool = this.get(name);
    if (!tool) {
      return {
        toolName: name,
        callId,
        success: false,
        output: "",
        error: `Tool not found: "${name}". Available tools: ${Array.from(this.tools.keys()).join(", ")}`,
      };
    }

    try {
      // Validate parameters against Zod schema
      const parsed = tool.parameters.parse(params);
      const output = await tool.execute(parsed, context);
      return {
        toolName: name,
        callId,
        success: true,
        output: typeof output === "string" ? output : JSON.stringify(output, null, 2),
      };
    } catch (err: any) {
      return {
        toolName: name,
        callId,
        success: false,
        output: "",
        error: `Error executing ${name}: ${err.message || String(err)}`,
      };
    }
  }
}

export const defaultToolRegistry = new ToolRegistry();
