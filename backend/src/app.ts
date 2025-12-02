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
import favoriteRoutes from "./routes/favorites.js";
import { WebSocketService } from "./services/websocketService.js";
import { sessionManager } from "./services/sessionManager.js";
import { containerManager } from "./services/containerManager.js";
import { cleanupJob } from "./services/cleanupJob.js";
import { challengeLoader } from "./services/challengeLoader.js";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.EXPRESS_PORT || 3008;
const server = createServer.createServer(app);

let webSocketService: WebSocketService;

// Middleware
app.use(express.json());
app.use(pinoHttp({ logger }));

const allowedOrigins = [
  `http://localhost:5173`, // Vite default
  `http://localhost:3008`, // Express default
   process.env.HOSTED_FRONTEND_URL || "", // Hosted frontend
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // for allow cookies/authentication
  }),
);

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
app.use("/api/favorites", favoriteRoutes);

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
    await initializeDatabase();

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
