import { test } from "node:test";
import assert from "node:assert/strict";
import { formatToast } from "../src/ui/toast.js";
import { formatDialog } from "../src/ui/dialog.js";
import { formatStatusBar } from "../src/ui/statusBar.js";
import { renderTerminalMarkdown } from "../src/ui/markdown.js";

test("TUI: formatToast produces boxed content with appropriate badge and message", () => {
  const successToast = formatToast({
    type: "success",
    title: "Key Saved",
    message: "Saved to .env",
  });
  assert.ok(successToast.includes("SUCCESS"));
  assert.ok(successToast.includes("Key Saved"));
  assert.ok(successToast.includes("Saved to .env"));

  const errorToast = formatToast({
    type: "error",
    title: "Connection Failed",
  });
  assert.ok(errorToast.includes("ERROR"));
  assert.ok(errorToast.includes("Connection Failed"));
});

test("TUI: formatDialog produces structured modal dialog with header and body", () => {
  const dialog = formatDialog({
    title: "Configuration Menu",
    body: "Please choose an option",
    footer: "Press Ctrl+C to abort",
  });
  assert.ok(dialog.includes("Configuration Menu"));
  assert.ok(dialog.includes("Please choose an option"));
  assert.ok(dialog.includes("Press Ctrl+C to abort"));
});

test("TUI: formatStatusBar formats BUILD and PLAN mode indicators with git info", () => {
  const buildBar = formatStatusBar({
    mode: "BUILD",
    model: "claude-3.5-sonnet",
    gitBranch: "main",
    totalChunks: 142,
  });
  assert.ok(buildBar.includes("BUILD MODE"));
  assert.ok(buildBar.includes("claude-3.5-sonnet"));
  assert.ok(buildBar.includes("main"));
  assert.ok(buildBar.includes("142"));

  const planBar = formatStatusBar({
    mode: "PLAN",
    model: "ollama/qwen2.5-coder:7b",
    gitBranch: "feature/tui",
    totalChunks: 88,
  });
  assert.ok(planBar.includes("PLAN MODE"));
  assert.ok(planBar.includes("ollama/qwen2.5-coder:7b"));
  assert.ok(planBar.includes("feature/tui"));
  assert.ok(planBar.includes("88"));
});

test("TUI: renderTerminalMarkdown parses code fences, inline backticks, and headers", () => {
  const markdown = [
    "# Section Title",
    "Here is `inline_var` and a code block:",
    "```typescript",
    "const x: number = 42;",
    "```",
  ].join("\n");

  const rendered = renderTerminalMarkdown(markdown);
  assert.ok(rendered.includes("SECTION TITLE"));
  assert.ok(rendered.includes("inline_var"));
  assert.ok(rendered.includes("const x: number = 42;"));
});
