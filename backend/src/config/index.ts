// src/config/index.ts
import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || "development",
  expressPort: parseInt(process.env.EXPRESS_PORT || "3000"),

  // auth
  jwtSecret: process.env.JWT_SECRET || "default_secret_key",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "10"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "72h",

  // Database
  dbPath: process.env.DB_PATH || "./data/db.sqlite",

  // Container settings
  docker: {
    imageName: process.env.DOCKER_IMAGE || "alpine:latest",
    challengesPath:
      process.env.CHALLENGES_PATH || path.join(process.cwd(), "challenges"),
    maxConcurrentSessions: parseInt(
      process.env.MAX_CONCURRENT_SESSIONS || "25",
    ),
    memoryLimit:
      parseInt(process.env.CONTAINER_MEMORY_MB || "256") * 1024 * 1024, // Convert to bytes
    cpuLimit: parseFloat(process.env.CONTAINER_CPU_LIMIT || "0.5"),
  },

  // Session timeouts
  session: {
    idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT_MS || "900000"), // 15 min
    maxSessionTimeMs: parseInt(process.env.MAX_SESSION_TIME_MS || "3600000"), // 60 min
  },

  // Cleanup
  cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || "60000"), // 1 min
};
