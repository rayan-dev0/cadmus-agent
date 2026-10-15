import { getDb } from "./database.js";

export interface CodeSearchResult {
  chunkId: string;
  filePath: string;
  symbolName: string | null;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
  matchType: "fts" | "vector" | "hybrid";
}

/**
 * Calculates cosine similarity between two float vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Sanitizes natural language query for FTS5 MATCH expression
 */
export function sanitizeFtsQuery(rawQuery: string): string {
  // Strip punctuation that could break FTS5 parser
  const cleaned = rawQuery.replace(/['"*^(){}[\]:;+~?|\\]/g, " ").trim();
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return '""';
  // Combine tokens with OR to allow flexible fuzzy matching
  return tokens.map((t) => `"${t}"*`).join(" OR ");
}

/**
 * Executes full-text BM25 search across indexed code chunks using SQLite FTS5
 */
export function searchLexical(query: string, limit: number = 20, dbPath?: string): CodeSearchResult[] {
  const db = getDb(dbPath);
  const matchExpr = sanitizeFtsQuery(query);

  if (matchExpr === '""') return [];

  try {
    const stmt = db.prepare(`
      SELECT 
        c.id as chunkId,
        c.file_path as filePath,
        c.symbol_name as symbolName,
        c.start_line as startLine,
        c.end_line as endLine,
        c.content as content,
        bm25(code_chunks_fts) as bm25_score
      FROM code_chunks_fts f
      JOIN code_chunks c ON f.rowid = c.rowid
      WHERE code_chunks_fts MATCH ?
      ORDER BY bm25_score ASC
      LIMIT ?
    `);

    const rows: any[] = stmt.all(matchExpr, limit);
    return rows.map((r, index) => ({
      chunkId: r.chunkId,
      filePath: r.filePath,
      symbolName: r.symbolName,
      startLine: r.startLine,
      endLine: r.endLine,
      content: r.content,
      // Invert BM25 so higher score is better for ranking
      score: 1 / (1 + Math.abs(r.bm25_score)),
      matchType: "fts" as const,
    }));
  } catch (err) {
    // If MATCH expression fails, fall back to simple LIKE pattern
    const fallbackStmt = db.prepare(`
      SELECT id as chunkId, file_path as filePath, symbol_name as symbolName, start_line as startLine, end_line as endLine, content
      FROM code_chunks
      WHERE content LIKE ? OR file_path LIKE ?
      LIMIT ?
    `);
    const likeQuery = `%${query.trim()}%`;
    const rows: any[] = fallbackStmt.all(likeQuery, likeQuery, limit);
    return rows.map((r) => ({
      chunkId: r.chunkId,
      filePath: r.filePath,
      symbolName: r.symbolName,
      startLine: r.startLine,
      endLine: r.endLine,
      content: r.content,
      score: 0.5,
      matchType: "fts" as const,
    }));
  }
}

/**
 * Executes vector similarity search against chunk embeddings in SQLite
 */
export function searchVector(queryVector: number[], limit: number = 20, dbPath?: string): CodeSearchResult[] {
  const db = getDb(dbPath);
  const stmt = db.prepare(`
    SELECT 
      c.id as chunkId,
      c.file_path as filePath,
      c.symbol_name as symbolName,
      c.start_line as startLine,
      c.end_line as endLine,
      c.content as content,
      e.embedding_json as embeddingJson
    FROM chunk_embeddings e
    JOIN code_chunks c ON e.chunk_id = c.id
  `);

  const rows: any[] = stmt.all();
  const scored: CodeSearchResult[] = [];

  for (const row of rows) {
    try {
      const vec: number[] = JSON.parse(row.embeddingJson);
      const sim = cosineSimilarity(queryVector, vec);
      if (sim > 0.1) {
        scored.push({
          chunkId: row.chunkId,
          filePath: row.filePath,
          symbolName: row.symbolName,
          startLine: row.startLine,
          endLine: row.endLine,
          content: row.content,
          score: sim,
          matchType: "vector",
        });
      }
    } catch {
      continue;
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Performs Hybrid Search combining FTS5 BM25 and Vector Search using Reciprocal Rank Fusion (RRF)
 */
export function searchHybrid(
  query: string,
  queryVector?: number[],
  limit: number = 10,
  dbPath?: string
): CodeSearchResult[] {
  const lexicalResults = searchLexical(query, 30, dbPath);

  // If no vector is provided, return pure lexical results
  if (!queryVector || queryVector.length === 0) {
    return lexicalResults.slice(0, limit);
  }

  const vectorResults = searchVector(queryVector, 30, dbPath);

  // Reciprocal Rank Fusion (RRF) algorithm: score(d) = sum(1 / (k + rank))
  const k = 60;
  const scoreMap = new Map<string, { result: CodeSearchResult; rrfScore: number }>();

  // Add lexical ranks
  lexicalResults.forEach((res, rank) => {
    const contribution = 1 / (k + rank + 1);
    scoreMap.set(res.chunkId, {
      result: { ...res, matchType: "hybrid" },
      rrfScore: contribution,
    });
  });

  // Add vector ranks
  vectorResults.forEach((res, rank) => {
    const contribution = 1 / (k + rank + 1);
    if (scoreMap.has(res.chunkId)) {
      const item = scoreMap.get(res.chunkId)!;
      item.rrfScore += contribution;
    } else {
      scoreMap.set(res.chunkId, {
        result: { ...res, matchType: "hybrid" },
        rrfScore: contribution,
      });
    }
  });

  const merged = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((item) => ({
      ...item.result,
      score: item.rrfScore,
    }));

  return merged.slice(0, limit);
}
