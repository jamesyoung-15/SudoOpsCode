import { Router, Response } from "express";
import { AuthRequest, authenticateToken } from "../middleware/auth.js";
import { containerPool, sessionManager } from "../app.js";
import { logger } from "../utils/logger.js";

const router = Router();

// Start a new challenge session
router.post(
  "/start/:challengeId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const challengeId = parseInt(req.params.challengeId);
      const userId = req.user!.userId;

      if (isNaN(challengeId)) {
        res.status(400).json({ error: "Invalid challenge ID" });
        return;
      }

      // Get container from pool
      const container = await containerPool.getContainer();

      if (!container) {
        logger.warn({ userId, challengeId }, "No containers available");
        res.status(503).json({
          error: "All containers are busy. Please try again in a moment.",
        });
        return;
      }

      // Create session
      const session = sessionManager.createSession(
        userId,
        container.id,
        challengeId,
      );

      logger.info(
        {
          sessionId: session.id,
          userId,
          challengeId,
          containerId: container.id,
        },
        "Challenge session started",
      );

      res.status(201).json({
        sessionId: session.id,
        challengeId: session.challengeId,
        message: "Session created successfully",
      });
    } catch (error) {
      logger.error({ error }, "Failed to start session");
      res.status(500).json({ error: "Failed to create session" });
    }
  },
);

// Get session info
router.get(
  "/:sessionId",
  authenticateToken,
  (req: AuthRequest, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const session = sessionManager.getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.userId !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    res.json({
      sessionId: session.id,
      challengeId: session.challengeId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    });
  },
);

// End session early
router.delete(
  "/:sessionId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.userId;

      const session = sessionManager.getSession(sessionId);

      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      if (session.userId !== userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      // Release container
      await containerPool.releaseContainer(session.containerId);

      // Delete session
      sessionManager.deleteSession(sessionId);

      logger.info({ sessionId, userId }, "Session ended by user");

      res.json({ message: "Session ended successfully" });
    } catch (error) {
      logger.error({ error }, "Failed to end session");
      res.status(500).json({ error: "Failed to end session" });
    }
  },
);

export default router;
