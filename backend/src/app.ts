import express from "express";
import { pinoHttp } from "pino-http";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";
import { initializeDatabase, closeDatabase } from "./db/database.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.EXPRESS_PORT || 3000;

// Middleware
app.use(express.json());
app.use(pinoHttp({ logger }));

// Routes
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Initialize database
initializeDatabase();

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Cleanup on exit
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
});

// Cleanup on Ctrl+C
process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
});

export { app };
