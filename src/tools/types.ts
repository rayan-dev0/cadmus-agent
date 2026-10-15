import { z } from "zod";

export interface ToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  parameters: z.ZodType<TParams>;
  jsonSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  requiresConfirmation: boolean;
  execute: (params: TParams, context: ToolContext) => Promise<TResult>;
}

export interface ToolContext {
  workspaceRoot: string;
  dbPath?: string;
  sessionId?: string;
  turnId?: string;
  autoApproveReadOnly?: boolean;
  autoApproveEdits?: boolean;
  onAskConfirmation?: (prompt: string) => Promise<boolean>;
  onAskDiffApproval?: (options: {
    filePath: string;
    patch: string;
    additions: number;
    deletions: number;
  }) => Promise<"accept" | "reject" | "always">;
}

export interface ToolCallResult {
  toolName: string;
  callId: string;
  success: boolean;
  output: string;
  error?: string;
}
