import { Sequelize } from "sequelize";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs/promises";

const dbPath = process.env.DB_PATH || "./data/database.sqlite";

// Ensure db directory exists
const dbDir = path.dirname(dbPath);
await fs.mkdir(dbDir, { recursive: true });

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

  // Import models to ensure they're initialized
  await import("../models/index.js");

  // Use Sequelize sync to create/update tables based on models
  // alter: true will add missing columns without dropping existing data
  await sequelize.sync({ alter: true });

  logger.info("Database schema initialized");
};

export const closeDatabase = async () => {
  await sequelize.close();
  logger.info("Database closed");
};
