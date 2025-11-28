import Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs";

const dbPath = process.env.DB_PATH || "./data/database.sqlite";

// Ensure db directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

export const initializeDatabase = () => {
  logger.info("Initializing database...");

  // Creates tables if they do not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      initial_files TEXT,
      validation_script TEXT NOT NULL,
      points INTEGER DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge_id INTEGER NOT NULL,
      passed BOOLEAN NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(challenge_id) REFERENCES challenges(id)
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON submissions(challenge_id);
  `);

  logger.info("Database initialized successfully");
};

export const closeDatabase = () => {
  db.close();
  logger.info("Database connection closed");
};
