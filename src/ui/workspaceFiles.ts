import fg from "fast-glob";
import { getDb } from "../db/database.js";

export interface WorkspaceFileInfo {
  path: string;
  lineCount?: number;
}

let cachedFiles: WorkspaceFileInfo[] = [];
let lastScanTime = 0;

/**
 * Returns indexed or cached workspace files for live @-autocomplete matching
 */
export function getWorkspaceFiles(
  workspaceRoot: string = process.cwd(),
  dbPath?: string
): WorkspaceFileInfo[] {
  const now = Date.now();
  if (cachedFiles.length > 0 && now - lastScanTime < 10000) {
    return cachedFiles;
  }

  // 1. Try SQLite file_cache first (instant)
  try {
    const db = getDb(dbPath);
    const rows: any[] = db
      .prepare("SELECT file_path, line_count FROM file_cache ORDER BY file_path ASC LIMIT 200")
      .all();
    if (rows && rows.length > 0) {
      cachedFiles = rows.map((r) => ({ path: r.file_path, lineCount: r.line_count }));
      lastScanTime = now;
      return cachedFiles;
    }
  } catch {
    // Fallback to fast-glob
  }

  // 2. Fallback to fast-glob
  try {
    const files = fg.sync(["**/*"], {
      cwd: workspaceRoot,
      ignore: ["**/node_modules/**", "**/.git/**", "**/.agent/**", "**/dist/**", "**/.test-*/**"],
      dot: false,
    });
    cachedFiles = files.slice(0, 200).map((f) => ({ path: f }));
    lastScanTime = now;
    return cachedFiles;
  } catch {
    return [];
  }
}
