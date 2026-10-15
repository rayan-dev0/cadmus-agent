export const SCHEMA_SQL = `
-- 1. Conversation sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    workspace_path TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. Messages and tool call history
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT CHECK(role IN ('system', 'user', 'assistant', 'tool')) NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- 3. File cache for fast incremental indexing
CREATE TABLE IF NOT EXISTS file_cache (
    file_path TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    line_count INTEGER NOT NULL,
    last_indexed_at INTEGER NOT NULL
);

-- 4. Code chunks extracted from files
CREATE TABLE IF NOT EXISTS code_chunks (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    symbol_name TEXT,
    symbol_type TEXT,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    content TEXT NOT NULL
);

-- 5. Full-Text Search (FTS5) table for fast lexical BM25 code search
CREATE VIRTUAL TABLE IF NOT EXISTS code_chunks_fts USING fts5(
    file_path,
    symbol_name,
    content,
    content='code_chunks',
    content_rowid='rowid'
);

-- Triggers to keep code_chunks_fts synchronized with code_chunks
CREATE TRIGGER IF NOT EXISTS code_chunks_ai AFTER INSERT ON code_chunks BEGIN
    INSERT INTO code_chunks_fts(rowid, file_path, symbol_name, content)
    VALUES (new.rowid, new.file_path, new.symbol_name, new.content);
END;

CREATE TRIGGER IF NOT EXISTS code_chunks_ad AFTER DELETE ON code_chunks BEGIN
    INSERT INTO code_chunks_fts(code_chunks_fts, rowid, file_path, symbol_name, content)
    VALUES('delete', old.rowid, old.file_path, old.symbol_name, old.content);
END;

CREATE TRIGGER IF NOT EXISTS code_chunks_au AFTER UPDATE ON code_chunks BEGIN
    INSERT INTO code_chunks_fts(code_chunks_fts, rowid, file_path, symbol_name, content)
    VALUES('delete', old.rowid, old.file_path, old.symbol_name, old.content);
    INSERT INTO code_chunks_fts(rowid, file_path, symbol_name, content)
    VALUES (new.rowid, new.file_path, new.symbol_name, new.content);
END;

-- 6. Embeddings storage for vector similarity search
CREATE TABLE IF NOT EXISTS chunk_embeddings (
    chunk_id TEXT PRIMARY KEY REFERENCES code_chunks(id) ON DELETE CASCADE,
    embedding_json TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    model TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 7. File snapshots for Undo & Rollback
CREATE TABLE IF NOT EXISTS file_snapshots (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_code_chunks_file ON code_chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_file_snapshots_turn ON file_snapshots(session_id, turn_id);
`;
