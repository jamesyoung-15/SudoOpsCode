import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import Docker from "dockerode";
import { logger } from "../utils/logger.js";
import { sessionManager } from "../app.js";
import { verifyToken } from "../middleware/auth.js";

const docker = new Docker();

interface WebSocketClient extends WebSocket {
  isAlive?: boolean;
  sessionId?: string;
  userId?: number;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: "/terminal",
    });

    this.wss.on("connection", this.handleConnection.bind(this));
    this.startHeartbeat();

    logger.info("WebSocket server initialized");
  }

  private handleConnection(ws: WebSocketClient, req: any) {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const sessionId = url.searchParams.get("sessionId");

    if (!token || !sessionId) {
      logger.warn("WebSocket connection rejected: missing token or sessionId");
      ws.close(1008, "Missing token or sessionId");
      return;
    }

    // Verify JWT token
    const decoded = verifyToken(token);
    if (!decoded) {
      logger.warn("WebSocket connection rejected: invalid token");
      ws.close(1008, "Invalid token");
      return;
    }

    // Verify session exists and belongs to user
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn(
        { sessionId },
        "WebSocket connection rejected: session not found",
      );
      ws.close(1008, "Session not found");
      return;
    }

    if (session.userId !== decoded.userId) {
      logger.warn(
        { sessionId, userId: decoded.userId },
        "WebSocket connection rejected: unauthorized",
      );
      ws.close(1008, "Unauthorized");
      return;
    }

    // Setup WebSocket client
    ws.isAlive = true;
    ws.sessionId = sessionId;
    ws.userId = decoded.userId;

    this.clients.set(sessionId, ws);

    logger.info(
      { sessionId, userId: decoded.userId, containerId: session.containerId },
      "WebSocket client connected",
    );

    // Attach to container
    this.attachToContainer(ws, session.containerId, sessionId);

    // Handle pong responses for heartbeat
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Handle client disconnect
    ws.on("close", () => {
      this.clients.delete(sessionId);
      logger.info({ sessionId }, "WebSocket client disconnected");
    });

    // Handle errors
    ws.on("error", (error) => {
      logger.error({ error, sessionId }, "WebSocket error");
    });
  }

  private async attachToContainer(
    ws: WebSocketClient,
    containerId: string,
    sessionId: string,
  ) {
    try {
      const container = docker.getContainer(containerId);

      // Create exec instance for interactive shell
      const exec = await container.exec({
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Cmd: ["/bin/bash"],
        Env: ["TERM=xterm-256color", "COLORTERM=truecolor"],
      });

      // Start the exec instance
      const stream = await exec.start({
        Tty: true,
        stdin: true,
        hijack: true,
      });

      // Pipe container output to WebSocket
      stream.on("data", (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk.toString("utf-8"));

          // Update session activity
          sessionManager.updateActivity(sessionId);
        }
      });

      // Pipe WebSocket input to container
      ws.on("message", (data: Buffer) => {
        try {
          const input = data.toString("utf-8");
          stream.write(input);

          // Update session activity
          sessionManager.updateActivity(sessionId);
        } catch (error) {
          logger.error(
            { error, sessionId },
            "Failed to write to container stream",
          );
        }
      });

      // Handle stream end
      stream.on("end", () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("\r\n[Container session ended]\r\n");
          ws.close();
        }
      });

      // Handle stream errors
      stream.on("error", (error: Error) => {
        logger.error(
          { error, sessionId, containerId },
          "Container stream error",
        );
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("\r\n[Error: Container connection lost]\r\n");
          ws.close();
        }
      });

      // Handle WebSocket close - cleanup stream
      ws.on("close", () => {
        stream.end();
      });

      logger.info({ sessionId, containerId }, "Terminal attached to container");

      // Send welcome message
      const welcomeMessage =
        "\r\n" +
        "=".repeat(60) +
        "\r\n" +
        "  Welcome to Sysadmin Challenge Platform\r\n" +
        "=".repeat(60) +
        "\r\n" +
        "\r\n";

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(welcomeMessage);
      }
    } catch (error) {
      logger.error(
        { error, sessionId, containerId },
        "Failed to attach to container",
      );
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("\r\n[Error: Failed to connect to container]\r\n");
        ws.close();
      }
    }
  }

  private startHeartbeat() {
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = ws as WebSocketClient;

        if (client.isAlive === false) {
          logger.warn(
            { sessionId: client.sessionId },
            "Terminating inactive WebSocket connection",
          );
          return client.terminate();
        }

        client.isAlive = false;
        client.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on("close", () => {
      clearInterval(interval);
    });

    logger.info("WebSocket heartbeat started");
  }

  broadcast(sessionId: string, message: string) {
    const client = this.clients.get(sessionId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  close() {
    this.wss.close();
    logger.info("WebSocket server closed");
  }
}
