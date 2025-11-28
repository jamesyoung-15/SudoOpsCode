import express from "express";
import createServer from "http";
import { pinoHttp } from "pino-http";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";
import { initializeDatabase, closeDatabase } from "./db/database.js";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import { ContainerPool } from "./services/containerPool.js";
import { SessionManager } from "./services/sessionManager.js";
import { CleanupService } from "./services/cleanup.js";
import { WebSocketService } from "./services/webSocket.js";
import { dockerConfig } from "./config/docker.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.EXPRESS_PORT || 3000;
const server = createServer.createServer(app);

// Initialize services
export const containerPool = new ContainerPool(dockerConfig);
export const sessionManager = new SessionManager(
  dockerConfig.idleTimeoutMs,
  dockerConfig.maxSessionTimeMs,
);
const cleanupService = new CleanupService(sessionManager, containerPool);
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

// temp add html serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Initialize
const startServer = async () => {
  try {
    // Initialize database
    initializeDatabase();

    // Initialize container pool
    await containerPool.initialize();

    // Initialize WebSocket service
    webSocketService = new WebSocketService(server);

    // Start cleanup service
    cleanupService.start();

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down gracefully");

      cleanupService.stop();

      server.close(async () => {
        await containerPool.cleanup();
        closeDatabase();
        process.exit(0);
      });
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
