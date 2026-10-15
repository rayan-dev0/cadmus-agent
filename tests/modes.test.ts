import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { AgentOrchestrator } from "../src/agent/orchestrator.js";
import { AgentConfig } from "../src/config.js";
import { getSystemPrompt } from "../src/agent/prompt.js";
import { closeDb } from "../src/db/database.js";

const TEST_DIR = path.resolve("./.test-modes-sandbox");
const mockConfig: AgentConfig = {
  workspaceRoot: TEST_DIR,
  dbPath: path.join(TEST_DIR, "test.db"),
  defaultModel: "mock/test-model",
  autoApproveReadOnly: true,
};

test.before(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

test.after(() => {
  closeDb();
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test("Modes: System prompt reflects BUILD mode vs PLAN mode constraints", () => {
  const buildPrompt = getSystemPrompt(TEST_DIR, "windows", "powershell", "BUILD");
  assert.ok(buildPrompt.includes("[BUILD MODE]"));
  assert.ok(buildPrompt.includes("You have full permission to propose targeted file edits"));

  const planPrompt = getSystemPrompt(TEST_DIR, "windows", "powershell", "PLAN");
  assert.ok(planPrompt.includes("[PLAN MODE]"));
  assert.ok(planPrompt.includes("SAFE READ-ONLY"));
});

test("Modes: AgentOrchestrator toggles between BUILD and PLAN mode", () => {
  const orchestrator = new AgentOrchestrator(mockConfig);
  assert.equal(orchestrator.mode, "BUILD");

  const toggled = orchestrator.toggleMode();
  assert.equal(toggled, "PLAN");
  assert.equal(orchestrator.mode, "PLAN");

  // Verify system prompt was updated in active messages
  const messages = orchestrator.getMessages();
  assert.equal(messages[0].role, "system");
  assert.ok(messages[0].content.includes("[PLAN MODE]"));

  orchestrator.toggleMode();
  assert.equal(orchestrator.mode, "BUILD");
  const updatedMessages = orchestrator.getMessages();
  assert.ok(updatedMessages[0].content.includes("[BUILD MODE]"));
});
