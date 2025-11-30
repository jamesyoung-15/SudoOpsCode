import express from "express";
import createServer from "http";
import { pinoHttp } from "pino-http";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";
import { initializeDatabase, closeDatabase } from "./db/database.js";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import challengeRoutes from "./routes/challenges.js";
import progressRoutes from "./routes/progress.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import { WebSocketService } from "./services/websocketService.js";
import { sessionManager } from "./services/sessionManager.js";
import { containerManager } from "./services/containerManager.js";
import { cleanupJob } from "./services/cleanupJob.js";
import { challengeLoader } from "./services/challengeLoader.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.EXPRESS_PORT || 3000;
const server = createServer.createServer(app);

let webSocketService: WebSocketService;

// Middleware
app.use(express.json());
app.use(pinoHttp({ logger }));

// CORS for development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Initialize
const startServer = async () => {
  try {
    // Initialize database
    initializeDatabase();

    // Load challenges
    await challengeLoader.loadChallenges();

    // Ensure Docker image exists
    await containerManager.ensureImage();

    // Initialize WebSocket service
    webSocketService = new WebSocketService(server);
    sessionManager.setWebSocketService(webSocketService);
    cleanupJob.setWebSocketService(webSocketService);

    // Start cleanup job
    cleanupJob.start();

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = async () => {
      if (isShuttingDown) return;

      isShuttingDown = true;
      logger.info("Shutting down gracefully");

      // Stop accepting new connections
      server.close(() => {
        logger.info("HTTP server closed");
      });

      // Stop cleanup job
      cleanupJob.stop();

      // Close all WebSocket connections (don't wait)
      webSocketService.shutdown();

      // Give streams a moment to close
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Clean up all active sessions
      const activeSessions = sessionManager.getActiveSessions();
      logger.info(
        { count: activeSessions.length },
        "Cleaning up active sessions",
      );

      for (const session of activeSessions) {
        try {
          await containerManager.removeContainer(session.containerId);
          sessionManager.endSession(session.id);
        } catch (error) {
          logger.error(
            { error, sessionId: session.id },
            "Failed to cleanup session",
          );
        }
      }

      // Close database
      closeDatabase();

      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
};

startServer();

export { app };
