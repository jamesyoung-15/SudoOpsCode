import { Sequelize } from "sequelize";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs";

const dbPath = process.env.DB_PATH || "./data/database.sqlite";

// Ensure db directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: (msg) => logger.debug(msg),
});

// Initialize schema
export const initializeDatabase = async () => {
  logger.info("Initializing database schema...");

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'medium', 'hard')),
      points INTEGER NOT NULL,
      category TEXT NOT NULL,
      solution TEXT,
      directory TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_challenges_difficulty ON challenges(difficulty);
    CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category);
    CREATE INDEX IF NOT EXISTS idx_challenges_directory ON challenges(directory);

    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge_id INTEGER NOT NULL,
      success BOOLEAN NOT NULL,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_challenge_id ON attempts(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_success ON attempts(success);

    CREATE TABLE IF NOT EXISTS solves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge_id INTEGER NOT NULL,
      solved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, challenge_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_solves_user_id ON solves(user_id);
    CREATE INDEX IF NOT EXISTS idx_solves_challenge_id ON solves(challenge_id);
    CREATE INDEX IF NOT EXISTS idx_solves_solved_at ON solves(solved_at);
  `);

  logger.info("Database schema initialized");
};

export const closeDatabase = async () => {
  await sequelize.close();
  logger.info("Database closed");
};