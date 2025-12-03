import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";
import { Challenge, Favorite, Solve } from "../models/index.js";
import { Op } from "sequelize";

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
    const totalFavorites = await Favorite.count({
      where: { user_id: userId },
    });

    const totalPages = Math.ceil(totalFavorites / limit);

    // Get paginated favorites with challenge details
    const favorites = await Favorite.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Challenge,
          as: "challenge",
          attributes: ["id", "title", "difficulty", "points", "category"],
          required: true,
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    // Check which challenges are solved
    const challengeIds = favorites.map((f) => f.challenge_id);
    const solvedChallenges = await Solve.findAll({
      where: {
        user_id: userId,
        challenge_id: { [Op.in]: challengeIds },
      },
      attributes: ["challenge_id"],
    });

    const solvedSet = new Set(solvedChallenges.map((s) => s.challenge_id));

    // Format response
    const formattedFavorites = favorites.map((favorite) => {
      const challenge = (favorite as any).challenge;
      return {
        id: challenge.id,
        title: challenge.title,
        difficulty: challenge.difficulty,
        points: challenge.points,
        category: challenge.category,
        favorited_at: favorite.created_at,
        solved: solvedSet.has(challenge.id) ? 1 : 0,
      };
    });

    res.json({
      favorites: formattedFavorites,
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
      const challenge = await Challenge.findByPk(challengeId);

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      // Add to favorites (findOrCreate handles duplicates)
      const [favorite, created] = await Favorite.findOrCreate({
        where: {
          user_id: userId,
          challenge_id: challengeId,
        },
        defaults: {
          user_id: userId,
          challenge_id: challengeId,
        },
      });

      if (created) {
        logger.info({ userId, challengeId }, "Added to favorites");
      } else {
        logger.debug({ userId, challengeId }, "Already in favorites");
      }

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

      const deleted = await Favorite.destroy({
        where: {
          user_id: userId,
          challenge_id: challengeId,
        },
      });

      logger.info({ userId, challengeId, deleted }, "Removed from favorites");
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

      const favorite = await Favorite.findOne({
        where: {
          user_id: userId,
          challenge_id: challengeId,
        },
      });

      res.json({ isFavorite: favorite !== null });
    } catch (error) {
      logger.error({ error }, "Failed to check favorite status");
      res.status(500).json({ error: "Failed to check favorite status" });
    }
  },
);

export default router;
