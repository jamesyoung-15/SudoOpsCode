import { Session } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private idleTimeoutMs: number;
  private maxSessionTimeMs: number;

  constructor(idleTimeoutMs: number, maxSessionTimeMs: number) {
    this.idleTimeoutMs = idleTimeoutMs;
    this.maxSessionTimeMs = maxSessionTimeMs;
  }

  createSession(
    userId: number,
    containerId: string,
    challengeId: number,
  ): Session {
    const sessionId = uuidv4();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      userId,
      containerId,
      challengeId,
      createdAt: now,
      lastActivity: now,
    };

    this.sessions.set(sessionId, session);

    logger.info(
      { sessionId, userId, containerId, challengeId },
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

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.info({ sessionId }, "Session deleted");
    }
    return deleted;
  }

  getStaleSessions(): Session[] {
    const now = Date.now();
    const staleSessions: Session[] = [];

    for (const session of this.sessions.values()) {
      const idleTime = now - session.lastActivity.getTime();
      const totalTime = now - session.createdAt.getTime();

      if (idleTime > this.idleTimeoutMs || totalTime > this.maxSessionTimeMs) {
        staleSessions.push(session);
      }
    }

    return staleSessions;
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}
