import fs from "node:fs";
import crypto from "node:crypto";
import { getDb } from "../db/database.js";
import { resolveWorkspacePath, toPosixPath } from "../utils/os.js";

export interface UndoResult {
  success: boolean;
  restoredFiles: string[];
  message: string;
}

/**
 * Snapshots a file's state before modification for reliable rollback
 */
export function snapshotFileForUndo(
  dbPath: string | undefined,
  sessionId: string,
  turnId: string,
  relPath: string,
  workspaceRoot: string
): void {
  try {
    const fullPath = resolveWorkspacePath(workspaceRoot, relPath);
    const posix = toPosixPath(relPath);
    const exists = fs.existsSync(fullPath);
    const content = exists ? fs.readFileSync(fullPath, "utf8") : "__FILE_DELETED__";

    const db = getDb(dbPath);
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO file_snapshots (id, session_id, turn_id, file_path, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, turnId, posix, content, Date.now());
  } catch {
    // Non-blocking snapshot
  }
}

/**
 * Reverts the file edits made during the most recent turn in the active session
 */
export function undoLastTurn(
  dbPath: string | undefined,
  sessionId: string,
  workspaceRoot: string
): UndoResult {
  const db = getDb(dbPath);

  // 1. Find the latest turn_id for this session
  const latestSnapshotRow: any = db
    .prepare(
      `SELECT turn_id, created_at FROM file_snapshots WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(sessionId);

  if (!latestSnapshotRow) {
    return {
      success: false,
      restoredFiles: [],
      message: "No recent file modifications to undo in this session.",
    };
  }

  const turnId = latestSnapshotRow.turn_id;

  // 2. Fetch all snapshots for this turn
  const snapshots: any[] = db
    .prepare(
      `SELECT file_path, content FROM file_snapshots WHERE session_id = ? AND turn_id = ?`
    )
    .all(sessionId, turnId);

  const restoredFiles: string[] = [];

  for (const snap of snapshots) {
    const fullPath = resolveWorkspacePath(workspaceRoot, snap.file_path);
    if (snap.content === "__FILE_DELETED__") {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        restoredFiles.push(`${snap.file_path} (removed created file)`);
      }
    } else {
      fs.writeFileSync(fullPath, snap.content, "utf8");
      restoredFiles.push(snap.file_path);
    }
  }

  // 3. Delete the snapshot records for this turn
  db.prepare(`DELETE FROM file_snapshots WHERE session_id = ? AND turn_id = ?`).run(
    sessionId,
    turnId
  );

  return {
    success: true,
    restoredFiles,
    message: `Reverted ${restoredFiles.length} file(s) from turn ${turnId.slice(0, 8)}`,
  };
}
