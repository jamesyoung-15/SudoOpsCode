import { SessionManager } from "./sessionManager.js";
import { ContainerPool } from "./containerPool.js";
import { logger } from "../utils/logger.js";

export class CleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private sessionManager: SessionManager;
  private containerPool: ContainerPool;
  private cleanupIntervalMs: number;

  constructor(
    sessionManager: SessionManager,
    containerPool: ContainerPool,
    cleanupIntervalMs: number = 300000, // 5 minutes
  ) {
    this.sessionManager = sessionManager;
    this.containerPool = containerPool;
    this.cleanupIntervalMs = cleanupIntervalMs;
  }

  start(): void {
    if (this.intervalId) {
      logger.warn("Cleanup service already running");
      return;
    }

    logger.info(
      { intervalMs: this.cleanupIntervalMs },
      "Starting cleanup service",
    );

    this.intervalId = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("Cleanup service stopped");
    }
  }

  private async cleanup(): Promise<void> {
    const staleSessions = this.sessionManager.getStaleSessions();

    if (staleSessions.length === 0) {
      logger.debug("No stale sessions to clean up");
      return;
    }

    logger.info(
      { staleSessionCount: staleSessions.length },
      "Cleaning up stale sessions",
    );

    for (const session of staleSessions) {
      try {
        // Release container
        await this.containerPool.releaseContainer(session.containerId);

        // Delete session
        this.sessionManager.deleteSession(session.id);

        logger.info(
          { sessionId: session.id, userId: session.userId },
          "Stale session cleaned up",
        );
      } catch (error) {
        logger.error(
          { error, sessionId: session.id },
          "Failed to clean up stale session",
        );
      }
    }
  }
}
