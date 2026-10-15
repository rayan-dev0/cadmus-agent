import path from "node:os";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

export interface AgentConfig {
  workspaceRoot: string;
  dbPath: string;
  defaultModel: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  embeddingProvider: "openai" | "ollama" | "local" | "none";
  embeddingModel: string;
  autoApproveReadOnly: boolean;
}

export function loadConfig(workspaceRoot: string = process.cwd()): AgentConfig {
  const agentDir = `${workspaceRoot}/.agent`;
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }

  return {
    workspaceRoot,
    dbPath: `${agentDir}/agent.db`,
    defaultModel: process.env.DEFAULT_MODEL || "claude-3-7-sonnet-latest",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    embeddingProvider: (process.env.EMBEDDING_PROVIDER as any) || "openai",
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    autoApproveReadOnly: true,
  };
}
