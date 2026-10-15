import test from "node:test";
import assert from "node:assert";
import { KeyPressMsg, WindowSizeMsg } from "@oakoliver/bubbletea";
import { createInitialModel, OpenCodeModel } from "../src/ui/bubble/model.js";
import { updateOpenCode } from "../src/ui/bubble/update.js";
import { renderOpenCodeView } from "../src/ui/bubble/view.js";
import { renderViewportLines, wrapLine } from "../src/ui/bubble/viewport.js";
import {
  TokenChunkMsg,
  TurnStartMsg,
  TurnFinishedMsg,
  ToolStartMsg,
  ToolCompleteMsg,
  DiffApprovalRequestMsg,
  ConfirmationRequestMsg,
} from "../src/ui/bubble/messages.js";

function makeKeyMsg(keyStr: string): any {
  return {
    _tag: "KeyPressMsg",
    text: keyStr,
    toString: () => keyStr,
  };
}

test("BubbleTea OpenCode: createInitialModel sets up dimensions, sessions, and mode", () => {
  const model = createInitialModel({
    workspaceName: "test-workspace",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "test-model",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 42,
    sessionId: "sess-1",
  });

  assert.strictEqual(model.workspaceName, "test-workspace");
  assert.strictEqual(model.modelName, "test-model");
  assert.strictEqual(model.mode, "BUILD");
  assert.strictEqual(model.sessions.length, 1);
  assert.strictEqual(model.sessions[0].id, "sess-1");
  assert.strictEqual(model.history.length, 1);
  assert.strictEqual(model.inputBuffer, "");
  assert.strictEqual(model.activeModal, null);
});

test("BubbleTea OpenCode: WindowSizeMsg resizes terminal dimensions", () => {
  const model = createInitialModel({
    workspaceName: "w",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "m",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 0,
    sessionId: "s",
  });

  const [updated] = updateOpenCode(new WindowSizeMsg(140, 45), model);
  assert.strictEqual(updated.termWidth, 140);
  assert.strictEqual(updated.termHeight, 45);
});

test("BubbleTea OpenCode: TokenChunkMsg appends tokens to assistant history", () => {
  const model = createInitialModel({
    workspaceName: "w",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "m",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 0,
    sessionId: "s",
  });

  updateOpenCode(new TurnStartMsg("Hello"), model);
  assert.strictEqual(model.isStreaming, true);
  assert.strictEqual(model.history[model.history.length - 1].type, "assistant");

  updateOpenCode(new TokenChunkMsg("World "), model);
  updateOpenCode(new TokenChunkMsg("from AI!"), model);

  const lastItem: any = model.history[model.history.length - 1];
  assert.strictEqual(lastItem.type, "assistant");
  assert.strictEqual(lastItem.text, "World from AI!");

  updateOpenCode(new TurnFinishedMsg("World from AI!"), model);
  assert.strictEqual(model.isStreaming, false);
});

test("BubbleTea OpenCode: ToolStartMsg and ToolCompleteMsg track tool cards", () => {
  const model = createInitialModel({
    workspaceName: "w",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "m",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 0,
    sessionId: "s",
  });

  updateOpenCode(new ToolStartMsg("read_file", { path: "src/index.ts" }), model);
  const toolItem: any = model.history[model.history.length - 1];
  assert.strictEqual(toolItem.type, "tool");
  assert.strictEqual(toolItem.options.toolName, "read_file");

  updateOpenCode(
    new ToolCompleteMsg("read_file", { path: "src/index.ts" }, "file contents", true, 18),
    model
  );
  assert.strictEqual(toolItem.options.output, "file contents");
  assert.strictEqual(toolItem.options.durationMs, 18);
  assert.strictEqual(toolItem.options.success, true);
});

test("BubbleTea OpenCode: DiffApprovalRequestMsg opens modal and handles accept/reject keys", () => {
  const model = createInitialModel({
    workspaceName: "w",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "m",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 0,
    sessionId: "s",
  });

  let decision: string | null = null;
  updateOpenCode(
    new DiffApprovalRequestMsg(
      {
        filePath: "package.json",
        patch: "@@ -1 +1 @@\n-old\n+new",
        additions: 1,
        deletions: 1,
      },
      (action) => {
        decision = action;
      }
    ),
    model
  );

  assert.strictEqual(model.activeModal, "DIFF_APPROVAL");
  assert.strictEqual(model.modalState.filePath, "package.json");

  // Pressing 'a' accepts
  updateOpenCode(makeKeyMsg("a"), model);
  assert.strictEqual(decision, "accept");
  assert.strictEqual(model.activeModal, null);
});

test("BubbleTea OpenCode: ConfirmationRequestMsg opens modal and handles y/n keys", () => {
  const model = createInitialModel({
    workspaceName: "w",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "m",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 0,
    sessionId: "s",
  });

  let allowed: boolean | null = null;
  updateOpenCode(
    new ConfirmationRequestMsg("Execute command?", (res) => {
      allowed = res;
    }),
    model
  );

  assert.strictEqual(model.activeModal, "CONFIRMATION");

  // Pressing 'y' allows
  updateOpenCode(makeKeyMsg("y"), model);
  assert.strictEqual(allowed, true);
  assert.strictEqual(model.activeModal, null);
});

test("BubbleTea OpenCode: Ctrl+P opens Command Palette and Ctrl+X opens Leader Key", () => {
  const model = createInitialModel({
    workspaceName: "w",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "m",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 0,
    sessionId: "s",
  });

  // Ctrl+P
  updateOpenCode(makeKeyMsg("ctrl+p"), model);
  assert.strictEqual(model.activeModal, "COMMAND_PALETTE");

  // Esc dismisses modal
  updateOpenCode(makeKeyMsg("esc"), model);
  assert.strictEqual(model.activeModal, null);

  // Ctrl+X
  updateOpenCode(makeKeyMsg("ctrl+x"), model);
  assert.strictEqual(model.activeModal, "LEADER_KEY");

  // Esc dismisses modal
  updateOpenCode(makeKeyMsg("esc"), model);
  assert.strictEqual(model.activeModal, null);
});

test("BubbleTea OpenCode: Tab toggles BUILD vs PLAN mode when buffer is empty", () => {
  const model = createInitialModel({
    workspaceName: "w",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "m",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 0,
    sessionId: "s",
    mode: "BUILD",
  });

  updateOpenCode(makeKeyMsg("tab"), model);
  assert.strictEqual(model.mode, "PLAN");

  updateOpenCode(makeKeyMsg("tab"), model);
  assert.strictEqual(model.mode, "BUILD");
});

test("BubbleTea OpenCode: Typing characters updates buffer and triggers autocomplete", () => {
  const model = createInitialModel({
    workspaceName: "w",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "m",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 0,
    sessionId: "s",
  });

  updateOpenCode(makeKeyMsg("/"), model);
  assert.strictEqual(model.inputBuffer, "/");
  assert.strictEqual(model.isAutocompleteOpen, true);
  assert.ok(model.suggestions.length > 0);

  updateOpenCode(makeKeyMsg("m"), model);
  assert.strictEqual(model.inputBuffer, "/m");
  const names = model.suggestions.map((s) => s.name);
  assert.ok(names.includes("/mode"));
  assert.ok(names.includes("/models"));
  assert.ok(!names.includes("/status"));
});

test("BubbleTea OpenCode: Viewport wrapping and line slicing", () => {
  const wrapped = wrapLine("This is a long sentence that should be wrapped cleanly across words", 20);
  assert.ok(wrapped.length > 1);

  const model = createInitialModel({
    workspaceName: "w",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "m",
    gitBranch: "main",
    gitDirty: false,
    totalChunks: 0,
    sessionId: "s",
  });

  const lines = renderViewportLines(model, 10);
  assert.strictEqual(lines.length, 10);
});

test("BubbleTea OpenCode: renderOpenCodeView generates complete screen string", () => {
  const model = createInitialModel({
    workspaceName: "my-project",
    workspaceRoot: process.cwd(),
    dbPath: ":memory:",
    modelName: "deepseek-coder",
    gitBranch: "feature/tui",
    gitDirty: true,
    totalChunks: 150,
    sessionId: "sess-main",
  });

  const rendered = renderOpenCodeView(model);
  assert.ok(rendered.includes("Cadmus"));
  assert.ok(rendered.includes("my-project"));
  assert.ok(rendered.includes("deepseek-coder"));
  assert.ok(rendered.includes("BUILD MODE"));
  assert.ok(rendered.includes("cadmus [BUILD] >"));
});
