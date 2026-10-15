import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import fg from "fast-glob";
import { getDb } from "./database.js";
import { chunkCodeFile, CodeChunk } from "./chunker.js";
import { toPosixPath } from "../utils/os.js";

// File extensions relevant for code indexing
export const SUPPORTED_EXTENSIONS = [
  "ts", "js", "tsx", "jsx", "mjs", "cjs",
  "py", "go", "rs", "java", "c", "cpp", "h", "hpp", "cs",
  "html", "css", "scss", "json", "yaml", "yml", "toml", "md", "sql", "sh", "ps1"
];

export interface IndexingResult {
  totalScanned: number;
  indexedFiles: number;
  skippedFiles: number;
  deletedFiles: number;
  totalChunks: number;
  durationMs: number;
}

/**
 * Scans and indexes workspace code files incrementally into SQLite
 */
export async function indexWorkspace(workspaceRoot: string, dbPath?: string): Promise<IndexingResult> {
  const startTime = Date.now();
  const db = getDb(dbPath);

  // Discover all files respecting common ignore patterns
  const patterns = SUPPORTED_EXTENSIONS.map((ext) => `**/*.${ext}`);
  const files = await fg(patterns, {
    cwd: workspaceRoot,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.agent/**",
      "**/coverage/**",
      "**/*.min.*",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ],
    dot: false,
    absolute: false,
  });

  const normalizedFiles = files.map(toPosixPath);
  const activeFileSet = new Set(normalizedFiles);

  let indexedCount = 0;
  let skippedCount = 0;
  let deletedCount = 0;

  // Prepare SQLite statements
  const selectCacheStmt = db.prepare("SELECT content_hash FROM file_cache WHERE file_path = ?");
  const deleteChunksStmt = db.prepare("DELETE FROM code_chunks WHERE file_path = ?");
  const upsertCacheStmt = db.prepare(`
    INSERT INTO file_cache (file_path, content_hash, line_count, last_indexed_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(file_path) DO UPDATE SET
      content_hash = excluded.content_hash,
      line_count = excluded.line_count,
      last_indexed_at = excluded.last_indexed_at
  `);
  const insertChunkStmt = db.prepare(`
    INSERT INTO code_chunks (id, file_path, symbol_name, symbol_type, start_line, end_line, content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Process active files
  for (const relPath of normalizedFiles) {
    const fullPath = path.join(workspaceRoot, relPath);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }

    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const cached: any = selectCacheStmt.get(relPath);

    if (cached && cached.content_hash === hash) {
      skippedCount++;
      continue;
    }

    // File is modified or newly added
    const lines = content.split(/\r?\n/);
    const chunks = chunkCodeFile(relPath, content);

    // Run within a transaction per file
    db.exec("BEGIN TRANSACTION;");
    try {
      deleteChunksStmt.run(relPath);
      for (const chunk of chunks) {
        insertChunkStmt.run(
          chunk.id,
          chunk.filePath,
          chunk.symbolName,
          chunk.symbolType,
          chunk.startLine,
          chunk.endLine,
          chunk.content
        );
      }
      upsertCacheStmt.run(relPath, hash, lines.length, Date.now());
      db.exec("COMMIT;");
      indexedCount++;
    } catch (err) {
      db.exec("ROLLBACK;");
      console.error(`Failed to index file ${relPath}:`, err);
    }
  }

  // 2. Remove deleted files from cache and chunks
  const allCached: any[] = db.prepare("SELECT file_path FROM file_cache").all();
  for (const row of allCached) {
    if (!activeFileSet.has(row.file_path)) {
      db.exec("BEGIN TRANSACTION;");
      try {
        db.prepare("DELETE FROM file_cache WHERE file_path = ?").run(row.file_path);
        deleteChunksStmt.run(row.file_path);
        db.exec("COMMIT;");
        deletedCount++;
      } catch {
        db.exec("ROLLBACK;");
      }
    }
  }

  const chunkCountRow: any = db.prepare("SELECT COUNT(*) as count FROM code_chunks").get();

  return {
    totalScanned: normalizedFiles.length,
    indexedFiles: indexedCount,
    skippedFiles: skippedCount,
    deletedFiles: deletedCount,
    totalChunks: chunkCountRow?.count || 0,
    durationMs: Date.now() - startTime,
  };
}
