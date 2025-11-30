import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { parse } from "url";
import { verifyToken } from "../middleware/auth.js";
import { sessionManager } from "./sessionManager.js";
import { containerManager } from "./containerManager.js";
import { logger } from "../utils/logger.js";
import { Duplex } from "stream";

interface ConnectionState {
  ws: WebSocket;
  stream: Duplex;
  cleanedUp: boolean; // similar to a thread lock
}

export class WebSocketService {
  private wss: WebSocketServer;
  private connections: Map<string, ConnectionState> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: "/terminal",
    });

    this.wss.on("connection", this.handleConnection.bind(this));
    logger.info("WebSocket service initialized");
  }

  private async handleConnection(ws: WebSocket, req: any) {
    const { query } = parse(req.url, true);
    const token = query.token as string;
    const sessionId = query.sessionId as string;

    // Validate token
    if (!token) {
      ws.close(1008, "Missing authentication token");
      return;
    }

    const user = verifyToken(token);
    if (!user) {
      ws.close(1008, "Invalid authentication token");
      return;
    }

    // Validate session
    if (!sessionId) {
      ws.close(1008, "Missing session ID");
      return;
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      ws.close(1008, "Invalid session ID");
      return;
    }

    if (session.userId !== user.userId) {
      ws.close(1008, "Session does not belong to user");
      return;
    }

    if (session.status !== "active") {
      ws.close(1008, "Session is not active");
      return;
    }

    logger.info(
      {
        sessionId,
        userId: user.userId,
        containerId: session.containerId,
      },
      "WebSocket terminal connection established",
    );

    try {
      // Create exec in container with PTY
      const exec = await containerManager.createExec(session.containerId, {
        Cmd: ["/bin/bash"],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true, // Important for terminal emulation
      });

      logger.debug(
        { sessionId, execId: exec.id },
        "Exec created, starting stream",
      );

      const stream = (await exec.start({
        hijack: true,
        stdin: true,
        Tty: true,
      })) as Duplex;

      logger.debug({ sessionId }, "Stream started successfully");

      // Store connection with stream
      this.connections.set(sessionId, {
        ws,
        stream,
        cleanedUp: false,
      });

      // Update session activity
      sessionManager.updateActivity(sessionId);

      // Handle WebSocket messages -> Docker stream
      ws.on("message", (data: Buffer) => {
        try {
          stream.write(data);
          sessionManager.updateActivity(sessionId);
        } catch (error) {
          logger.error(
            { error, sessionId },
            "Error writing to container stream",
          );
        }
      });

      // Handle Docker stream -> WebSocket
      stream.on("data", (chunk: Buffer) => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk);
          }
        } catch (error) {
          logger.error({ error, sessionId }, "Error sending data to WebSocket");
        }
      });

      // Handle disconnection - only cleanup once (similar to a thread lock)
      const cleanup = () => {
        const state = this.connections.get(sessionId);
        if (!state || state.cleanedUp) {
          return; // Already cleaned up
        }

        logger.info({ sessionId }, "Cleaning up WebSocket connection");
        state.cleanedUp = true; // mark as cleaned up, similar to acquiring a lock

        try {
          // Remove all listeners to prevent multiple cleanup calls
          stream.removeAllListeners();
          ws.removeAllListeners();

          // Destroy stream without waiting
          setImmediate(() => {
            try {
              stream.destroy();
            } catch (err) {
              logger.debug(
                { error: err, sessionId },
                "Error destroying stream (ignored)",
              );
            }
          });
        } catch (error) {
          logger.error({ error, sessionId }, "Error during cleanup");
        } finally {
          this.connections.delete(sessionId);
          logger.debug({ sessionId }, "WebSocket connection cleaned up");
        }
      };

      ws.on("close", () => {
        logger.debug({ sessionId }, "WebSocket closed by client");
        cleanup();
      });

      ws.on("error", (error) => {
        logger.error({ error, sessionId }, "WebSocket error");
        cleanup();
      });

      stream.on("error", (error) => {
        logger.error({ error, sessionId }, "Container stream error");
        cleanup();
      });

      stream.on("end", () => {
        logger.debug({ sessionId }, "Container stream ended");
        cleanup();
      });
    } catch (error) {
      logger.error(
        {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                }
              : error,
          sessionId,
        },
        "Failed to create container exec",
      );
      ws.close(1011, "Failed to attach to container");
    }
  }

  public closeConnection(sessionId: string): void {
    const state = this.connections.get(sessionId);
    if (!state || state.cleanedUp) {
      logger.debug({ sessionId }, "Connection already closed or not found");
      return;
    }

    logger.debug({ sessionId }, "Closing WebSocket connection");

    try {
      // Mark as cleaned up first to prevent race conditions
      state.cleanedUp = true;

      // Close WebSocket if still open
      if (state.ws.readyState === WebSocket.OPEN) {
        state.ws.close(1000, "Session ended");
      }

      // Destroy stream without waiting
      setImmediate(() => {
        try {
          state.stream.destroy();
        } catch (err) {
          logger.debug(
            { error: err, sessionId },
            "Error destroying stream (ignored)",
          );
        }
      });

      this.connections.delete(sessionId);
      logger.debug({ sessionId }, "WebSocket connection force-closed");
    } catch (error) {
      logger.error({ error, sessionId }, "Error closing connection");
      this.connections.delete(sessionId);
    }
  }

  public getActiveConnections(): number {
    return this.connections.size;
  }

  public shutdown() {
    logger.info(
      { count: this.connections.size },
      "Shutting down WebSocket service",
    );

    const sessionIds = Array.from(this.connections.keys());

    // Close all connections without waiting
    sessionIds.forEach((sessionId) => {
      this.closeConnection(sessionId);
    });

    this.connections.clear();

    // Close WebSocket server
    this.wss.close(() => {
      logger.info("WebSocket server closed");
    });
  }
}
