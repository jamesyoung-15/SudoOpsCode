import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { containerManager } from "../services/containerManager.js";
import { sessionManager } from "../services/sessionManager.js";
import { progressService } from "../services/progressService.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.post("/start", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { challengeId } = req.body;
    const userId = req.user!.userId;

    if (!challengeId || !userId) {
      return res
        .status(400)
        .json({ error: "Challenge ID and User ID required" });
    }

    // Check if session creation is already in progress
    if (sessionManager.isSessionPending(userId, challengeId)) {
      return res
        .status(409)
        .json({ error: "Session creation already in progress" });
    }

    // Check if user can create session (eg. already reached max sessions)
    const canCreate = sessionManager.canCreateSession(userId);
    if (!canCreate.allowed) {
      return res.status(429).json({ error: canCreate.reason });
    }

    // Check if user already has active session
    const existingSessions = sessionManager.getUserSessions(userId);
    const existingSession = existingSessions.find(
      (s) => s.challengeId === challengeId,
    );

    if (existingSession) {
      return res.json({
        sessionId: existingSession.id,
        expiresAt: existingSession.expiresAt,
        message: "Existing session found",
      });
    }

    // Mark as pending to prevent race condition
    sessionManager.markSessionPending(userId, challengeId);

    try {
      // Create container
      const containerId = await containerManager.createContainer(
        challengeId,
        userId,
      );

      // Create session
      const session = sessionManager.createSession(
        userId,
        challengeId,
        containerId,
      );

      res.json({
        sessionId: session.id,
        expiresAt: session.expiresAt,
      });
    } finally {
      // Always clear pending flag
      sessionManager.clearSessionPending(userId, challengeId);
    }
  } catch (error) {
    logger.error({ error, body: req.body }, "Failed to start session");
    res.status(500).json({ error: "Failed to start session" });
  }
});

// Validate and submit solution
router.post(
  "/:sessionId/validate",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.userId;

      logger.info({ sessionId, userId }, "Validation requested");

      // Get session
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (session.status !== "active") {
        return res.status(400).json({ error: "Session is not active" });
      }

      // Check if already solved
      const hasSolved = await progressService.hasSolved(userId, session.challengeId);
      // Below for disabling re-submission after solve
      // if (hasSolved) {
      //   return res.status(400).json({
      //     error: "Challenge already solved",
      //     success: false,
      //   });
      // }

      logger.info(
        {
          sessionId,
          userId,
          challengeId: session.challengeId,
          containerId: session.containerId,
        },
        "Running validation",
      );

      // Run validation script
      const isValid = await containerManager.validateChallenge(
        session.containerId,
        session.challengeId,
      );

      // Record attempt and solve tables in single transaction
      await progressService.recordValidation(userId, session.challengeId, isValid, hasSolved);

      if (isValid) {
        const points = await progressService.getChallengePoints(session.challengeId);

        logger.info(
          {
            sessionId,
            userId,
            challengeId: session.challengeId,
            points: hasSolved ? 0 : points,
          },
          "Challenge solved!",
        );

        // Clean up session and container
        try {
          await containerManager.removeContainer(session.containerId);
          sessionManager.endSession(sessionId);
        } catch (cleanupError) {
          logger.error(
            { error: cleanupError, sessionId },
            "Failed to cleanup after solve",
          );
          // Don't fail the request if cleanup fails
        }

        res.json({
          success: true,
          message: "Congratulations! Challenge solved!",
          points: hasSolved ? 0 : points,
        });
      } else {
        logger.info(
          { sessionId, userId, challengeId: session.challengeId },
          "Validation failed",
        );

        res.json({
          success: false,
          message: "Validation failed. Keep trying!",
        });
      }
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
          sessionId: req.params.sessionId,
          userId: req.user?.userId,
        },
        "Failed to validate solution",
      );

      res.status(500).json({
        error: "Failed to validate solution",
        success: false,
      });
    }
  },
);

// Get session info
router.get("/:sessionId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    res.json({
      sessionId: session.id,
      challengeId: session.challengeId,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastActivity: session.lastActivity,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : error,
        sessionId: req.params.sessionId,
      },
      "Failed to get session",
    );
    res.status(500).json({ error: "Failed to get session" });
  }
});

// End a session
router.delete(
  "/:sessionId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.userId;

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Remove container (this stops and removes it)
      await containerManager.removeContainer(session.containerId);

      // End session
      sessionManager.endSession(sessionId);

      res.json({ message: "Session ended" });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : error,
          sessionId: req.params.sessionId,
        },
        "Failed to end session",
      );
      res.status(500).json({ error: "Failed to end session" });
    }
  },
);

// List user's active sessions
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const sessions = sessionManager.getUserSessions(userId);

    res.json({
      sessions: sessions.map((s) => ({
        sessionId: s.id,
        challengeId: s.challengeId,
        status: s.status,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        lastActivity: s.lastActivity,
      })),
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.userId,
      },
      "Failed to list sessions",
    );
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

export default router;
