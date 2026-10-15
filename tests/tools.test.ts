import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { defaultToolRegistry } from "../src/tools/registry.js";
import { ToolContext } from "../src/tools/types.js";

const TEST_DIR = path.resolve("./.test-sandbox");
const context: ToolContext = {
  workspaceRoot: TEST_DIR,
  autoApproveReadOnly: true,
};

test.before(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, "sample.txt"), "Line 1: Hello\nLine 2: World\nLine 3: Coding Agent\n");
});

test.after(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test("ToolRegistry registers all 7 tools", () => {
  const tools = defaultToolRegistry.getAll();
  assert.equal(tools.length, 7);
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "codebase_search",
    "edit_file",
    "file_search",
    "grep_search",
    "list_dir",
    "read_file",
    "run_terminal_command",
  ]);
});

test("Tool: read_file", async () => {
  const res = await defaultToolRegistry.execute("read_file", "c1", { path: "sample.txt", start_line: 1, end_line: 2 }, context);
  assert.equal(res.success, true);
  assert.ok(res.output.includes("Line 1: Hello"));
  assert.ok(res.output.includes("Line 2: World"));
  assert.ok(!res.output.includes("Line 3: Coding Agent"));
});

test("Tool: edit_file", async () => {
  const res = await defaultToolRegistry.execute("edit_file", "c2", {
    path: "sample.txt",
    target_content: "Line 2: World",
    replacement_content: "Line 2: Antigravity",
  }, context);
  assert.equal(res.success, true);
  assert.ok(res.output.includes("Successfully updated"));

  const updated = fs.readFileSync(path.join(TEST_DIR, "sample.txt"), "utf8");
  assert.ok(updated.includes("Line 2: Antigravity"));
});

test("Tool: list_dir", async () => {
  const res = await defaultToolRegistry.execute("list_dir", "c3", { path: "." }, context);
  assert.equal(res.success, true);
  assert.ok(res.output.includes("sample.txt"));
});

test("Tool: file_search", async () => {
  const res = await defaultToolRegistry.execute("file_search", "c4", { pattern: "sample*" }, context);
  assert.equal(res.success, true);
  assert.ok(res.output.includes("sample.txt"));
});

test("Tool: grep_search with bundled ripgrep", async () => {
  const res = await defaultToolRegistry.execute("grep_search", "c5", { query: "Antigravity" }, context);
  assert.equal(res.success, true);
  assert.ok(res.output.includes("sample.txt:2"));
  assert.ok(res.output.includes("Antigravity"));
});

test("Tool: run_terminal_command", async () => {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "echo 'agent testing'" : "echo 'agent testing'";
  const res = await defaultToolRegistry.execute("run_terminal_command", "c6", { command: cmd }, context);
  assert.equal(res.success, true);
  assert.ok(res.output.includes("agent testing"));
});

test("Tool: edit_file respects onAskDiffApproval rejection", async () => {
  const rejectContext: ToolContext = {
    workspaceRoot: TEST_DIR,
    onAskDiffApproval: async () => "reject",
  };

  const res = await defaultToolRegistry.execute("edit_file", "c7", {
    path: "sample.txt",
    target_content: "Line 2: Antigravity",
    replacement_content: "Line 2: Rejected",
  }, rejectContext);

  assert.equal(res.success, false);
  assert.ok(res.error?.includes("User rejected changes"));
});

test("Tool: edit_file handles onAskDiffApproval 'always'", async () => {
  let promptCalls = 0;
  const alwaysContext: ToolContext = {
    workspaceRoot: TEST_DIR,
    onAskDiffApproval: async () => {
      promptCalls++;
      return "always";
    },
  };

  // First edit prompts and returns 'always'
  const res1 = await defaultToolRegistry.execute("edit_file", "c8", {
    path: "sample.txt",
    target_content: "Line 2: Antigravity",
    replacement_content: "Line 2: Accepted1",
  }, alwaysContext);
  assert.equal(res1.success, true);
  assert.equal(promptCalls, 1);
  assert.equal(alwaysContext.autoApproveEdits, true);

  // Subsequent edit with autoApproveEdits does not prompt
  const res2 = await defaultToolRegistry.execute("edit_file", "c9", {
    path: "sample.txt",
    target_content: "Line 2: Accepted1",
    replacement_content: "Line 2: Accepted2",
  }, alwaysContext);
  assert.equal(res2.success, true);
  assert.equal(promptCalls, 1); // Not called again
});
