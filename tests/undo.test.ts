import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getDb, closeDb } from "../src/db/database.js";
import { snapshotFileForUndo, undoLastTurn } from "../src/agent/undoManager.js";

test("UndoManager: Snapshots and rolls back modified file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-undo-test-"));
  const dbPath = path.join(tempDir, "test.db");

  try {
    const sessionId = "test-session-1";
    const turnId = "turn-abc-123";
    const targetFile = "src/example.txt";
    const fullPath = path.join(tempDir, targetFile);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, "Original content line 1\nOriginal content line 2", "utf8");

    // Initialize DB & Snapshot before change
    getDb(dbPath);
    snapshotFileForUndo(dbPath, sessionId, turnId, targetFile, tempDir);

    // Simulate edit
    fs.writeFileSync(fullPath, "Modified content line 1\nModified content line 2\nLine 3", "utf8");
    assert.equal(fs.readFileSync(fullPath, "utf8").includes("Modified content"), true);

    // Rollback via undoLastTurn
    const result = undoLastTurn(dbPath, sessionId, tempDir);
    assert.equal(result.success, true);
    assert.equal(result.restoredFiles.length, 1);
    assert.equal(fs.readFileSync(fullPath, "utf8"), "Original content line 1\nOriginal content line 2");

    // Check second undo reports nothing left
    const secondResult = undoLastTurn(dbPath, sessionId, tempDir);
    assert.equal(secondResult.success, false);
  } finally {
    closeDb();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best-effort
    }
  }
});

test("UndoManager: Deletes newly created files on rollback", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-undo-newfile-"));
  const dbPath = path.join(tempDir, "test.db");

  try {
    const sessionId = "test-session-2";
    const turnId = "turn-newfile-456";
    const newFile = "new_created_file.txt";
    const fullPath = path.join(tempDir, newFile);

    getDb(dbPath);

    // Snapshot before file exists (records __FILE_DELETED__)
    snapshotFileForUndo(dbPath, sessionId, turnId, newFile, tempDir);

    // Create file
    fs.writeFileSync(fullPath, "Brand new file content", "utf8");
    assert.equal(fs.existsSync(fullPath), true);

    // Rollback should delete it
    const result = undoLastTurn(dbPath, sessionId, tempDir);
    assert.equal(result.success, true);
    assert.equal(fs.existsSync(fullPath), false);
  } finally {
    closeDb();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best-effort
    }
  }
});
