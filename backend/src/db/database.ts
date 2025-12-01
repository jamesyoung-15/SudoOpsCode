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

  // Enable WAL mode for better concurrency
  await sequelize.query("PRAGMA journal_mode = WAL");
  
  // Set synchronous mode to NORMAL for better performance (still safe with WAL)
  await sequelize.query("PRAGMA synchronous = NORMAL");
  
  // Enable foreign key constraints
  await sequelize.query("PRAGMA foreign_keys = ON");
  
  // Increase cache size (negative value = KB, positive = pages)
  // -64000 = 64MB cache
  await sequelize.query("PRAGMA cache_size = -64000");
  
  // Set busy timeout to 5 seconds (5000ms) to handle locked database
  await sequelize.query("PRAGMA busy_timeout = 5000");
  
  // Use memory-mapped I/O for better performance (256MB)
  await sequelize.query("PRAGMA mmap_size = 268435456");

  // Create users table
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
  );

  // Create challenges table
  await sequelize.query(`
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
    )
  `);

  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_challenges_difficulty ON challenges(difficulty)`,
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category)`,
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_challenges_directory ON challenges(directory)`,
  );

  // Create attempts table
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge_id INTEGER NOT NULL,
      success BOOLEAN NOT NULL,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);

  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id)`,
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_attempts_challenge_id ON attempts(challenge_id)`,
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_attempts_success ON attempts(success)`,
  );

  // Create solves table
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS solves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge_id INTEGER NOT NULL,
      solved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, challenge_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);

  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_solves_user_id ON solves(user_id)`,
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_solves_challenge_id ON solves(challenge_id)`,
  );
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS idx_solves_solved_at ON solves(solved_at)`,
  );

  logger.info("Database schema initialized");
};

export const closeDatabase = async () => {
  await sequelize.close();
  logger.info("Database closed");
};
