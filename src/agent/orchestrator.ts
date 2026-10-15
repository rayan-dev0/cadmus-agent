import crypto from "node:crypto";
import chalk from "chalk";
import ora from "ora";
import { AgentConfig } from "../config.js";
import { ChatMessage, LLMResponse } from "../llm/types.js";
import { LLMProvider } from "../llm/provider.js";
import { defaultToolRegistry } from "../tools/registry.js";
import { ToolContext } from "../tools/types.js";
import { parseAndResolveAttachments } from "../attachments/parser.js";
import { getSystemPrompt } from "./prompt.js";
import { getPlatform, getSystemShell } from "../utils/os.js";
import { getDb } from "../db/database.js";
import { AgentMode } from "./modes.js";
import { undoLastTurn } from "./undoManager.js";

export interface RunTurnEvents {
  silent?: boolean;
  onToken?: (token: string) => void;
  onToolStart?: (toolName: string, args: any) => void;
  onToolComplete?: (toolName: string, args: any, output: string, success: boolean, durationMs: number) => void;
}

export class AgentOrchestrator {
  private llm: LLMProvider;
  private messages: ChatMessage[] = [];
  public sessionId: string;
  public mode: AgentMode = "BUILD";
  public autoApproveEdits: boolean = false;

  constructor(
    private config: AgentConfig,
    private onConfirm?: (prompt: string) => Promise<boolean>,
    private onDiffApproval?: (options: {
      filePath: string;
      patch: string;
      additions: number;
      deletions: number;
    }) => Promise<"accept" | "reject" | "always">
  ) {
    this.llm = new LLMProvider(config);
    this.sessionId = crypto.randomUUID();
    this.initSession();
  }

  setConfirmationHandler(handler: (prompt: string) => Promise<boolean>) {
    this.onConfirm = handler;
  }

  setDiffApprovalHandler(
    handler: (options: {
      filePath: string;
      patch: string;
      additions: number;
      deletions: number;
    }) => Promise<"accept" | "reject" | "always">
  ) {
    this.onDiffApproval = handler;
  }

  private initSession(): void {
    const db = getDb(this.config.dbPath);
    db.prepare(`
      INSERT INTO sessions (id, title, workspace_path, model, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      this.sessionId,
      "Coding Session",
      this.config.workspaceRoot,
      this.config.defaultModel,
      Date.now(),
      Date.now()
    );

    const platform = getPlatform();
    const shell = getSystemShell();
    const systemPrompt = getSystemPrompt(this.config.workspaceRoot, platform, shell.shell, this.mode);

    this.messages = [
      {
        role: "system",
        content: systemPrompt,
      },
    ];
  }

  setMode(newMode: AgentMode): void {
    this.mode = newMode;
    const platform = getPlatform();
    const shell = getSystemShell();
    if (this.messages.length > 0 && this.messages[0].role === "system") {
      this.messages[0].content = getSystemPrompt(this.config.workspaceRoot, platform, shell.shell, this.mode);
    }
  }

  toggleMode(): AgentMode {
    const next = this.mode === "BUILD" ? "PLAN" : "BUILD";
    this.setMode(next);
    return this.mode;
  }

  /**
   * Processes a user prompt through attachment expansion and the autonomous ReAct tool loop
   */
  async runTurn(
    rawPrompt: string,
    onTokenOrEvents?: ((token: string) => void) | RunTurnEvents
  ): Promise<string> {
    const isCallback = typeof onTokenOrEvents === "function";
    const onToken = isCallback ? onTokenOrEvents : onTokenOrEvents?.onToken;
    const events = isCallback ? undefined : onTokenOrEvents;
    const isSilent = !!events?.silent;

    const turnId = crypto.randomUUID();
    const toolContext: ToolContext = {
      workspaceRoot: this.config.workspaceRoot,
      dbPath: this.config.dbPath,
      sessionId: this.sessionId,
      turnId,
      autoApproveReadOnly: this.config.autoApproveReadOnly,
      autoApproveEdits: this.autoApproveEdits,
      onAskConfirmation: this.onConfirm,
      onAskDiffApproval: this.onDiffApproval,
    };

    // 1. Parse and expand @-attachments
    let spinner: any = null;
    if (!isSilent) {
      spinner = ora("Resolving context attachments...").start();
    }
    const expanded = await parseAndResolveAttachments(rawPrompt, toolContext);
    if (spinner) {
      spinner.stop();
    }

    if (!isSilent && expanded.attachments.length > 0) {
      console.log(
        chalk.dim(
          `📎 Attached: ${expanded.attachments.map((a) => `${a.type}:${a.target}`).join(", ")}`
        )
      );
    }

    // OpenCode Inline Command (!cmd) executes immediately without LLM turn
    if (expanded.isInlineCommand) {
      return expanded.inlineCommandOutput || "(Command executed)";
    }

    const fullUserMessage = `${expanded.cleanedPrompt}${expanded.formattedContext}`;

    this.messages.push({
      role: "user",
      content: fullUserMessage,
    });
    this.saveMessage("user", fullUserMessage);

    // Filter tools if operating in PLAN Mode
    let tools = defaultToolRegistry.getSchemas();
    if (this.mode === "PLAN") {
      tools = tools.filter((t) => t.name !== "edit_file" && t.name !== "run_terminal_command");
    }

    let turnDone = false;
    let finalAssistantReply = "";
    let stepCount = 0;
    const maxSteps = 15;

    while (!turnDone && stepCount < maxSteps) {
      stepCount++;

      let toolCallStarted = false;
      const response: LLMResponse = await this.llm.chat(this.messages, tools, {
        onToken: (tok) => {
          onToken?.(tok);
        },
        onToolCallStart: (tName) => {
          if (!isSilent && !toolCallStarted) {
            toolCallStarted = true;
            process.stdout.write("\n");
          }
        },
      });

      finalAssistantReply = response.content;

      // Add assistant response to history
      this.messages.push({
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      });
      this.saveMessage("assistant", response.content, response.toolCalls);

      // If no tool calls requested, we have completed the turn
      if (!response.toolCalls || response.toolCalls.length === 0) {
        turnDone = true;
        break;
      }

      // Execute each tool call
      for (const tc of response.toolCalls) {
        let toolSpinner: any = null;
        if (!isSilent) {
          toolSpinner = ora(chalk.cyan(`Executing ${tc.name}...`)).start();
        }
        if (events?.onToolStart) {
          events.onToolStart(tc.name, tc.arguments);
        }

        const startToolTime = Date.now();
        const result = await defaultToolRegistry.execute(tc.name, tc.id, tc.arguments, toolContext);
        const durationMs = Date.now() - startToolTime;

        if (toolSpinner) {
          if (result.success) {
            toolSpinner.succeed(chalk.green(`✓ ${tc.name}`));
          } else {
            toolSpinner.fail(chalk.red(`✗ ${tc.name}: ${result.error}`));
          }
        }

        const toolOutput = result.success ? result.output : `Tool Error: ${result.error}`;

        if (events?.onToolComplete) {
          events.onToolComplete(tc.name, tc.arguments, toolOutput, result.success, durationMs);
        }

        if (toolContext.autoApproveEdits) {
          this.autoApproveEdits = true;
        }

        // Append tool result into conversation
        this.messages.push({
          role: "tool",
          content: toolOutput,
          toolCallId: tc.id,
        });
        this.saveMessage("tool", toolOutput, undefined, tc.id);
      }
    }

    return finalAssistantReply;
  }

  private saveMessage(
    role: "system" | "user" | "assistant" | "tool",
    content: string,
    toolCalls?: any[],
    toolCallId?: string
  ): void {
    try {
      const db = getDb(this.config.dbPath);
      const msgId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        msgId,
        this.sessionId,
        role,
        content,
        toolCalls ? JSON.stringify(toolCalls) : null,
        toolCallId || null,
        Date.now()
      );
    } catch {
      // Ignore DB write errors during execution
    }
  }

  async compactHistory(): Promise<{ summary: string; originalCount: number; newCount: number }> {
    const originalCount = this.messages.length;
    if (originalCount <= 2) {
      return {
        summary: "Conversation is already compact.",
        originalCount,
        newCount: originalCount,
      };
    }

    const prompt =
      "Summarize the key facts, decisions, modifications, and context from this conversation so far in concise bullet points. Maintain any active file paths or requirements.";

    const response = await this.llm.chat([
      ...this.messages,
      { role: "user", content: prompt },
    ], []);

    const summaryText = response.content || "Session compacted.";
    const sys = this.messages[0];

    this.messages = [
      sys,
      {
        role: "user",
        content: "Previous conversation context (compacted):",
      },
      {
        role: "assistant",
        content: summaryText,
      },
    ];

    return {
      summary: summaryText,
      originalCount,
      newCount: this.messages.length,
    };
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  undoTurn(): { success: boolean; restoredFiles: string[]; message: string } {
    const res = undoLastTurn(this.config.dbPath, this.sessionId, this.config.workspaceRoot);
    if (res.success) {
      const lastUserIndex = this.messages.map((m) => m.role).lastIndexOf("user");
      if (lastUserIndex !== -1) {
        this.messages = this.messages.slice(0, lastUserIndex);
      }
    }
    return res;
  }

  clearHistory(): void {
    const sys = this.messages[0];
    this.messages = sys ? [sys] : [];
    this.sessionId = crypto.randomUUID();
    this.initSession();
  }
}
