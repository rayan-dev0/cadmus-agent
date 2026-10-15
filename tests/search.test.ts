import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getDb, closeDb } from "../src/db/database.js";
import { chunkCodeFile } from "../src/db/chunker.js";
import { indexWorkspace } from "../src/db/indexer.js";
import { searchLexical, searchHybrid, cosineSimilarity } from "../src/db/search.js";

const TEST_DB = ".agent/test-search.db";

test("Code chunker extracts symbols and lines", () => {
  const code = `
export function add(a: number, b: number): number {
  return a + b;
}

export class Calculator {
  multiply(x: number, y: number): number {
    return x * y;
  }
}
  `;

  const chunks = chunkCodeFile("src/calc.ts", code);
  assert.ok(chunks.length >= 1);
  assert.equal(chunks[0].filePath, "src/calc.ts");
});

test("SQLite indexer and FTS5 search", async () => {
  // Use isolated test db
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const db = getDb(TEST_DB);

  // Insert a test chunk directly
  const chunk = {
    id: "test1",
    filePath: "src/auth/jwt.ts",
    symbolName: "verifyJwtToken",
    symbolType: "function",
    startLine: 1,
    endLine: 10,
    content: "function verifyJwtToken(token: string) { return jwt.verify(token); }",
  };

  db.prepare(`
    INSERT INTO code_chunks (id, file_path, symbol_name, symbol_type, start_line, end_line, content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(chunk.id, chunk.filePath, chunk.symbolName, chunk.symbolType, chunk.startLine, chunk.endLine, chunk.content);

  // Search lexical with FTS5
  const results = searchLexical("verifyJwtToken", 5, TEST_DB);
  assert.ok(results.length > 0);
  assert.equal(results[0].filePath, "src/auth/jwt.ts");
  assert.equal(results[0].symbolName, "verifyJwtToken");

  // Test Cosine Similarity
  const v1 = [1, 0, 0];
  const v2 = [1, 0, 0];
  const v3 = [0, 1, 0];
  assert.equal(cosineSimilarity(v1, v2), 1);
  assert.equal(cosineSimilarity(v1, v3), 0);

  // Test Hybrid Search fallback to lexical
  const hybrid = searchHybrid("jwt token", undefined, 5, TEST_DB);
  assert.ok(hybrid.length > 0);
  assert.equal(hybrid[0].filePath, "src/auth/jwt.ts");

  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});
