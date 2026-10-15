import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema.js";

let dbInstance: DatabaseSync | null = null;

/**
 * Initializes or returns the singleton SQLite database instance
 */
export function getDb(dbPath: string = ".agent/agent.db"): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure parent directory exists
  const dir = path.dirname(dbPath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL mode and foreign keys for optimal performance and safety
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA foreign_keys = ON;");

  // Run schema migrations
  dbInstance.exec(SCHEMA_SQL);

  return dbInstance;
}

/**
 * Closes the database connection
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
