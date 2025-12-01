import { Router, Response } from "express";
import { sequelize } from "../db/database.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";
import { QueryTypes } from "sequelize";

const router = Router();

/**
 * GET /api/favorites
 * Get user's favorite challenges with pagination
 * Query params: page (default: 1), limit (default: 20)
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        error:
          "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100",
      });
    }

    // Get total count
    const countResult = (await sequelize.query(
      `SELECT COUNT(*) as total FROM favorites WHERE user_id = ?`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      },
    )) as Array<{ total: number }>;

    const totalFavorites = countResult[0].total;
    const totalPages = Math.ceil(totalFavorites / limit);

    // Get paginated favorites
    const favorites = await sequelize.query(
      `SELECT 
        c.id,
        c.title,
        c.difficulty,
        c.points,
        c.category,
        f.created_at as favorited_at,
        CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END as solved
      FROM favorites f
      JOIN challenges c ON f.challenge_id = c.id
      LEFT JOIN solves s ON c.id = s.challenge_id AND s.user_id = ?
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?`,
      {
        replacements: [userId, userId, limit, offset],
        type: QueryTypes.SELECT,
      },
    );

    res.json({
      favorites,
      pagination: {
        page,
        limit,
        totalFavorites,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch favorites");
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

/**
 * POST /api/favorites/:challengeId
 * Add challenge to favorites
 */
router.post(
  "/:challengeId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const challengeId = parseInt(req.params.challengeId);

      if (isNaN(challengeId)) {
        return res.status(400).json({ error: "Invalid challenge ID" });
      }

      // Check if challenge exists
      const challenge = await sequelize.query(
        "SELECT id FROM challenges WHERE id = ?",
        {
          replacements: [challengeId],
          type: QueryTypes.SELECT,
        },
      );

      if (challenge.length === 0) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      // Add to favorites (ignore if already exists)
      await sequelize.query(
        "INSERT OR IGNORE INTO favorites (user_id, challenge_id) VALUES (?, ?)",
        {
          replacements: [userId, challengeId],
          type: QueryTypes.INSERT,
        },
      );

      logger.info({ userId, challengeId }, "Added to favorites");
      res.json({ message: "Added to favorites" });
    } catch (error) {
      logger.error({ error }, "Failed to add favorite");
      res.status(500).json({ error: "Failed to add favorite" });
    }
  },
);

/**
 * DELETE /api/favorites/:challengeId
 * Remove challenge from favorites
 */
router.delete(
  "/:challengeId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const challengeId = parseInt(req.params.challengeId);

      if (isNaN(challengeId)) {
        return res.status(400).json({ error: "Invalid challenge ID" });
      }

      await sequelize.query(
        "DELETE FROM favorites WHERE user_id = ? AND challenge_id = ?",
        {
          replacements: [userId, challengeId],
          type: QueryTypes.DELETE,
        },
      );

      logger.info({ userId, challengeId }, "Removed from favorites");
      res.json({ message: "Removed from favorites" });
    } catch (error) {
      logger.error({ error }, "Failed to remove favorite");
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  },
);

/**
 * GET /api/favorites/check/:challengeId
 * Check if challenge is favorited
 */
router.get(
  "/check/:challengeId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const challengeId = parseInt(req.params.challengeId);

      if (isNaN(challengeId)) {
        return res.status(400).json({ error: "Invalid challenge ID" });
      }

      const result = await sequelize.query(
        "SELECT id FROM favorites WHERE user_id = ? AND challenge_id = ?",
        {
          replacements: [userId, challengeId],
          type: QueryTypes.SELECT,
        },
      );

      res.json({ isFavorite: result.length > 0 });
    } catch (error) {
      logger.error({ error }, "Failed to check favorite status");
      res.status(500).json({ error: "Failed to check favorite status" });
    }
  },
);

export default router;
