import { test } from "node:test";
import assert from "node:assert/strict";
import { getPlatform, getSystemShell, toPosixPath, detectLineEnding } from "../src/utils/os.js";
import { checkPrerequisites, resolveRipgrepPath } from "../src/utils/prereqs.js";

test("OS utils detect platform and shell", () => {
  const platform = getPlatform();
  assert.ok(["windows", "macos", "linux"].includes(platform));

  const shell = getSystemShell();
  assert.ok(shell.shell.length > 0);
  assert.ok(Array.isArray(shell.args));

  const posix = toPosixPath("src\\utils\\test.ts");
  assert.equal(posix, "src/utils/test.ts");

  assert.equal(detectLineEnding("line1\r\nline2"), "\r\n");
  assert.equal(detectLineEnding("line1\nline2"), "\n");
});

test("Prereqs resolver detects ripgrep successfully", () => {
  const prereqs = checkPrerequisites();
  assert.equal(prereqs.ripgrep.available, true);
  assert.ok(prereqs.ripgrep.version.toLowerCase().includes("ripgrep"));
  assert.ok(["system", "bundled"].includes(prereqs.ripgrep.source));

  const resolved = resolveRipgrepPath();
  assert.ok(resolved.path.length > 0);
});
