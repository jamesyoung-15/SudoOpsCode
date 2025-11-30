import { logger } from "../utils/logger.js";
import { containerManager } from "./containerManager.js";
import crypto from "crypto";
import { Session } from "../types/session.js";
import { WebSocketService } from "./websocketService.js";

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private pendingSessions: Set<string> = new Set(); // Track in-progress sessions, prevent duplicates

  private idleTimeoutMs: number;
  private maxSessionTimeMs: number;
  private wsService?: WebSocketService;
  private readonly MAX_SESSIONS_PER_USER = 1;
  private readonly MAX_TOTAL_SESSIONS = 15;

  constructor(
    idleTimeoutMs: number = 10 * 60 * 1000, // 10 min
    maxSessionTimeMs: number = 15 * 60 * 1000, // 15 min
  ) {
    this.idleTimeoutMs = idleTimeoutMs;
    this.maxSessionTimeMs = maxSessionTimeMs;
  }

  canCreateSession(userId: number): { allowed: boolean; reason?: string } {
    // Check user limit
    const userSessions = this.getUserSessions(userId);
    if (userSessions.length >= this.MAX_SESSIONS_PER_USER) {
      return {
        allowed: false,
        reason: `Maximum ${this.MAX_SESSIONS_PER_USER} active session(s) per user`,
      };
    }

    // Check system limit
    const totalSessions = this.getActiveSessions().length;
    if (totalSessions >= this.MAX_TOTAL_SESSIONS) {
      return {
        allowed: false,
        reason: "System at capacity. Please try again later.",
      };
    }

    return { allowed: true };
  }

  createSession(
    userId: number,
    challengeId: number,
    containerId: string,
  ): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      challengeId,
      containerId,
      status: "active",
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.maxSessionTimeMs),
    };

    this.sessions.set(session.id, session);
    logger.info(
      { sessionId: session.id, userId, challengeId },
      "Session created",
    );
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  setWebSocketService(service: WebSocketService): void {
    this.wsService = service;
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "ended";
      this.sessions.delete(sessionId);

      logger.info({ sessionId }, "Session ended");

      // Close WebSocket connection asynchronously (don't wait)
      if (this.wsService) {
        setImmediate(() => {
          try {
            this.wsService!.closeConnection(sessionId);
          } catch (error) {
            logger.debug(
              { error, sessionId },
              "Error closing WebSocket (ignored)",
            );
          }
        });
      }
    }
  }

  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "active",
    );
  }

  getUserSessions(userId: number): Session[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId && s.status === "active",
    );
  }

  getExpiredSessions(): Session[] {
    const now = new Date();
    return Array.from(this.sessions.values()).filter((session) => {
      const idleExpired =
        now.getTime() - session.lastActivity.getTime() > this.idleTimeoutMs;
      const maxTimeExpired = now > session.expiresAt;
      return session.status === "active" && (idleExpired || maxTimeExpired);
    });
  }

  markExpired(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "expired";
      this.sessions.delete(sessionId);
      logger.info({ sessionId }, "Session marked as expired");
    }
  }

  /**
   * Check if session creation is already in progress
   */
  isSessionPending(userId: number, challengeId: number): boolean {
    const key = `${userId}-${challengeId}`;
    return this.pendingSessions.has(key);
  }

  /**
   * Mark session creation as in-progress
   */
  markSessionPending(userId: number, challengeId: number): void {
    const key = `${userId}-${challengeId}`;
    this.pendingSessions.add(key);
  }

  /**
   * Clear pending flag
   */
  clearSessionPending(userId: number, challengeId: number): void {
    const key = `${userId}-${challengeId}`;
    this.pendingSessions.delete(key);
  }

  /**
   * Clean up stale sessions
   * Called by CleanupJob
   */
  async cleanupStaleSessions(): Promise<void> {
    const expiredSessions = this.getExpiredSessions();

    if (expiredSessions.length === 0) {
      logger.debug("No stale sessions to clean up");
      return;
    }

    logger.info(
      { count: expiredSessions.length },
      "Cleaning up stale sessions",
    );

    for (const session of expiredSessions) {
      try {
        const idleTime = Date.now() - session.lastActivity.getTime();
        const isIdleExpired = idleTime > this.idleTimeoutMs;
        const isMaxTimeExpired = new Date() > session.expiresAt;

        logger.info(
          {
            sessionId: session.id,
            userId: session.userId,
            challengeId: session.challengeId,
            containerId: session.containerId,
            idleTimeMinutes: Math.floor(idleTime / 1000 / 60),
            isIdleExpired,
            isMaxTimeExpired,
          },
          "Cleaning up expired session",
        );

        // Remove container
        await containerManager.removeContainer(session.containerId);

        // Mark session as expired
        this.markExpired(session.id);

        logger.info(
          { sessionId: session.id },
          "Session cleaned up successfully",
        );
      } catch (error) {
        logger.error(
          { error, sessionId: session.id, containerId: session.containerId },
          "Failed to cleanup session",
        );

        // Still mark as expired even if container removal failed
        // to avoid repeatedly trying to clean up the same session
        this.markExpired(session.id);
      }
    }
  }
}

export const sessionManager = new SessionManager();
