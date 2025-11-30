import { Sequelize } from "sequelize";

// Create in-memory SQLite for tests
export const testSequelize = new Sequelize({
  dialect: "sqlite",
  storage: ":memory:",
  logging: false,
});

let isInitialized = false;

export const initTestDatabase = async () => {
  if (isInitialized) {
    return;
  }

  try {
    // Test connection
    await testSequelize.authenticate();

    // Create tables one by one
    await testSequelize.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await testSequelize.query(`
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
    `);
    await testSequelize.query(`
      CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        challenge_id INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
      );
    `);

    await testSequelize.query(`
      CREATE TABLE IF NOT EXISTS solves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        challenge_id INTEGER NOT NULL,
        solved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, challenge_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
      );
    `);

    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize test database:", error);
    throw error;
  }
};

export const cleanTestDatabase = async () => {
  if (!isInitialized) {
    await initTestDatabase();
  }

  try {
    // Disable foreign keys temporarily for SQLite
    await testSequelize.query("PRAGMA foreign_keys = OFF");
    
    // Delete data from tables
    await testSequelize.query("DELETE FROM solves");
    await testSequelize.query("DELETE FROM attempts");
    await testSequelize.query("DELETE FROM challenges");
    await testSequelize.query("DELETE FROM users");
    
    // Reset auto-increment counters
    await testSequelize.query("DELETE FROM sqlite_sequence WHERE name='solves'");
    await testSequelize.query("DELETE FROM sqlite_sequence WHERE name='attempts'");
    await testSequelize.query("DELETE FROM sqlite_sequence WHERE name='challenges'");
    await testSequelize.query("DELETE FROM sqlite_sequence WHERE name='users'");
    
    // Re-enable foreign keys
    await testSequelize.query("PRAGMA foreign_keys = ON");
    
  } catch (error) {
    console.error("Failed to clean test database:", error);
    throw error;
  }
};

export const closeTestDatabase = async () => {
  try {
    await testSequelize.close();
    isInitialized = false;
  } catch (error) {
    throw error;
  }
};