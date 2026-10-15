import { Model, Cmd, Msg, NewProgram, Program, WithAltScreen } from "@oakoliver/bubbletea";
import { OpenCodeModel, createInitialModel } from "./model.js";
import { updateOpenCode, UpdateHandlers } from "./update.js";
import { renderOpenCodeView } from "./view.js";
import { AgentOrchestrator } from "../../agent/orchestrator.js";
import { AgentConfig } from "../../config.js";
import {
  TokenChunkMsg,
  TurnStartMsg,
  TurnFinishedMsg,
  TurnErrorMsg,
  ToolStartMsg,
  ToolCompleteMsg,
  DiffApprovalRequestMsg,
  ConfirmationRequestMsg,
  ToastMsg,
} from "./messages.js";
import { indexWorkspace } from "../../db/indexer.js";

/**
 * OpenCode Bubble Tea Application implementing Elm Architecture Model
 */
export class OpenCodeTeaApp implements Model {
  public state: OpenCodeModel;
  private program?: Program;

  constructor(
    initialState: OpenCodeModel,
    private orchestrator: AgentOrchestrator,
    private config: AgentConfig
  ) {
    this.state = initialState;
  }

  setProgram(p: Program): void {
    this.program = p;
  }

  init(): Cmd {
    return null;
  }

  update(msg: Msg): [Model, Cmd] {
    const handlers: UpdateHandlers = {
      onSubmitPrompt: (prompt: string) => {
        this.executeTurn(prompt);
        return null;
      },
      onSlashCommand: (cmd: string) => {
        this.handleSlashCommand(cmd);
        return null;
      },
    };

    const [nextState, cmd] = updateOpenCode(msg, this.state, handlers);
    this.state = nextState;
    return [this, cmd];
  }

  view(): string {
    return renderOpenCodeView(this.state);
  }

  private async executeTurn(prompt: string): Promise<void> {
    if (!this.program) return;

    this.program.send(new TurnStartMsg(prompt));

    try {
      const reply = await this.orchestrator.runTurn(prompt, {
        silent: true,
        onToken: (tok) => {
          this.program?.send(new TokenChunkMsg(tok));
        },
        onToolStart: (toolName, args) => {
          this.program?.send(new ToolStartMsg(toolName, args));
        },
        onToolComplete: (toolName, args, output, success, durationMs) => {
          this.program?.send(
            new ToolCompleteMsg(toolName, args, output, success, durationMs)
          );
        },
      });

      this.program.send(new TurnFinishedMsg(reply));
    } catch (err: any) {
      this.program.send(new TurnErrorMsg(err.message || String(err)));
    }
  }

  private async handleSlashCommand(rawCmd: string): Promise<void> {
    const trimmed = rawCmd.trim();
    const cmd = trimmed.toLowerCase();

    if (cmd === "/clear") {
      this.orchestrator.clearHistory();
      this.state.history = [
        { type: "system", text: "✓ Conversation session reset." },
      ];
      this.program?.send(
        new ToastMsg("success", "Session Reset", "Started fresh session")
      );
      return;
    }

    if (cmd === "/details") {
      this.state.showDetails = !this.state.showDetails;
      this.program?.send(
        new ToastMsg(
          "info",
          "Tool Details",
          this.state.showDetails ? "Expanded tool details view" : "Compact tool view"
        )
      );
      return;
    }

    if (cmd === "/undo") {
      const undoRes = this.orchestrator.undoTurn();
      if (undoRes.success) {
        this.program?.send(new ToastMsg("success", "Turn Undone", undoRes.message));
        this.state.history.push({
          type: "system",
          text: `✓ ${undoRes.message}`,
        });
      } else {
        this.program?.send(new ToastMsg("warning", "Nothing to Undo", undoRes.message));
      }
      return;
    }

    if (cmd === "/compact") {
      try {
        const res = await this.orchestrator.compactHistory();
        this.program?.send(
          new ToastMsg(
            "success",
            "History Compacted",
            `Reduced to ${res.newCount} messages: ${res.summary}`
          )
        );
        this.state.history.push({
          type: "system",
          text: `✓ Compacted history: ${res.summary}`,
        });
      } catch (err: any) {
        this.program?.send(new ToastMsg("error", "Compact Failed", err.message));
      }
      return;
    }

    if (cmd === "/index") {
      try {
        const stats = await indexWorkspace(this.config.workspaceRoot, this.config.dbPath);
        this.state.totalChunks = stats.totalChunks;
        this.program?.send(
          new ToastMsg(
            "success",
            "Indexing Completed",
            `Indexed ${stats.indexedFiles} files (${stats.totalChunks} chunks) in ${stats.durationMs}ms`
          )
        );
        this.state.history.push({
          type: "system",
          text: `✓ Indexed ${stats.indexedFiles} files (${stats.totalChunks} total chunks) in ${stats.durationMs}ms`,
        });
      } catch (err: any) {
        this.program?.send(new ToastMsg("error", "Indexing Failed", err.message));
      }
      return;
    }

    if (cmd.startsWith("/model")) {
      const parts = rawCmd.split(/\s+/);
      if (parts.length >= 2) {
        const newModel = parts[1];
        this.config.defaultModel = newModel;
        this.state.modelName = newModel;
        this.program?.send(
          new ToastMsg("success", "Model Switched", `Active model: ${newModel}`)
        );
        this.state.history.push({
          type: "system",
          text: `✓ Switched active model to: ${newModel}`,
        });
      } else {
        this.program?.send(
          new ToastMsg("info", "Current Model", this.config.defaultModel)
        );
      }
      return;
    }

    this.state.history.push({
      type: "system",
      text: `Unknown command: ${rawCmd}. Press Ctrl+P for Command Palette or Ctrl+X for shortcuts.`,
    });
  }
}

/**
 * Boots the OpenCode Bubble Tea alternate-screen TUI
 */
export async function runOpenCodeBubbleTUI(
  config: AgentConfig,
  orchestrator: AgentOrchestrator,
  initialProps: {
    workspaceName: string;
    gitBranch: string;
    gitDirty: boolean;
    totalChunks: number;
  }
): Promise<void> {
  const initialState = createInitialModel({
    workspaceName: initialProps.workspaceName,
    workspaceRoot: config.workspaceRoot,
    dbPath: config.dbPath,
    modelName: config.defaultModel,
    gitBranch: initialProps.gitBranch,
    gitDirty: initialProps.gitDirty,
    totalChunks: initialProps.totalChunks,
    sessionId: orchestrator.sessionId,
    mode: orchestrator.mode,
  });

  const app = new OpenCodeTeaApp(initialState, orchestrator, config);
  const program = NewProgram(app, WithAltScreen());
  app.setProgram(program);

  // Wire orchestrator approval callbacks to Bubble Tea program
  orchestrator.setDiffApprovalHandler((options) => {
    return new Promise<"accept" | "reject" | "always">((resolve) => {
      program.send(new DiffApprovalRequestMsg(options, resolve));
    });
  });

  orchestrator.setConfirmationHandler((prompt) => {
    return new Promise<boolean>((resolve) => {
      program.send(new ConfirmationRequestMsg(prompt, resolve));
    });
  });

  await program.run();
}
