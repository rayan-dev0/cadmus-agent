import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseAndResolveAttachments } from "../src/attachments/parser.js";
import { ToolContext } from "../src/tools/types.js";

const TEST_DIR = path.resolve("./.test-attachments-sandbox");
const context: ToolContext = {
  workspaceRoot: TEST_DIR,
  autoApproveReadOnly: true,
};

test.before(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, "auth.ts"), "export function login() { return true; }\n");
});

test.after(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test("Parses and resolves @file and @git attachments", async () => {
  const prompt = "Can you review @file auth.ts and also check @git changes?";
  const result = await parseAndResolveAttachments(prompt, context);

  assert.equal(result.attachments.length, 2);
  const types = result.attachments.map((a) => a.type).sort();
  assert.deepEqual(types, ["file", "git"]);

  const fileAtt = result.attachments.find((a) => a.type === "file");
  assert.ok(fileAtt?.content.includes("export function login"));

  assert.ok(result.formattedContext.includes("<context_attachments>"));
  assert.ok(result.cleanedPrompt.includes("Can you review"));
});

test("Parses and slices @file with line windows #start-end", async () => {
  fs.writeFileSync(
    path.join(TEST_DIR, "multiline.ts"),
    "line 1\nline 2\nline 3\nline 4\nline 5\n"
  );

  const prompt = "Inspect @file multiline.ts#2-4";
  const result = await parseAndResolveAttachments(prompt, context);

  assert.equal(result.attachments.length, 1);
  const att = result.attachments[0];
  assert.equal(att.type, "file");
  assert.equal(att.target, "multiline.ts#2-4");
  assert.ok(att.content.includes("Showing lines 2-4"));
  assert.ok(att.content.includes("line 2"));
  assert.ok(att.content.includes("line 4"));
  assert.ok(!att.content.includes("line 1"));
  assert.ok(!att.content.includes("line 5"));
});

test("Executes inline ! shell commands directly", async () => {
  const prompt = "!node -e \"console.log('inline-tui-success')\"";
  const result = await parseAndResolveAttachments(prompt, context);

  assert.equal(result.isInlineCommand, true);
  assert.ok(result.inlineCommandOutput?.includes("inline-tui-success"));
});
