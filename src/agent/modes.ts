export type AgentMode = "BUILD" | "PLAN";

export interface ModeConfig {
  mode: AgentMode;
  allowEdits: boolean;
  allowTerminalExecution: boolean;
  description: string;
}

export const MODES: Record<AgentMode, ModeConfig> = {
  BUILD: {
    mode: "BUILD",
    allowEdits: true,
    allowTerminalExecution: true,
    description: "Full coding agent with tool execution, file editing, and terminal commands.",
  },
  PLAN: {
    mode: "PLAN",
    allowEdits: false,
    allowTerminalExecution: false,
    description: "Read-only exploration & architecture planning. No disk edits or shell execution.",
  },
};
