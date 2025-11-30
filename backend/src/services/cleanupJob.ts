import { logger } from "../utils/logger.js";
import { sessionManager } from "./sessionManager.js";
import { WebSocketService } from "./websocketService.js";

export class CleanupJob {
  private interval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private wsService?: WebSocketService;

  /**
   * Start the cleanup job
   */
  start(): void {
    if (this.interval) {
      logger.warn("Cleanup job already running");
      return;
    }

    logger.info("Starting cleanup job");

    this.interval = setInterval(async () => {
      try {
        logger.debug("Running cleanup job");
        await sessionManager.cleanupStaleSessions();
      } catch (error) {
        logger.error({ error }, "Cleanup job failed");
      }
    }, this.CLEANUP_INTERVAL);

    // Run immediately on start
    sessionManager.cleanupStaleSessions().catch((error) => {
      logger.error({ error }, "Initial cleanup failed");
    });
  }

  setWebSocketService(service: WebSocketService): void {
    this.wsService = service;
  }

  /**
   * Stop the cleanup job
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info("Cleanup job stopped");
    }
  }
}

export const cleanupJob = new CleanupJob();
