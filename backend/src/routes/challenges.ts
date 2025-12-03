import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";
import { Challenge, Solve, Attempt } from "../models/index.js";
import { Op, fn, col, literal } from "sequelize";

const router = Router();

/**
 * GET /api/challenges/public
 * Get all challenges (public, no auth required)
 * Query params: page (default: 1), limit (default: 20)
 */
router.get("/public", async (req, res) => {
  try {
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
    const totalChallenges = await Challenge.count();
    const totalPages = Math.ceil(totalChallenges / limit);

    // Get paginated challenges with solve count
    const challenges = await Challenge.findAll({
      attributes: [
        "id",
        "title",
        "description",
        "difficulty",
        "points",
        "category",
        "created_at",
        [fn("COUNT", fn("DISTINCT", col("solves.user_id"))), "solve_count"],
      ],
      include: [
        {
          model: Solve,
          as: "solves",
          attributes: [],
          required: false,
        },
      ],
      group: ["Challenge.id"],
      order: [["id", "ASC"]],
      limit,
      offset,
      subQuery: false,
    });

    res.json({
      challenges,
      pagination: {
        page,
        limit,
        totalChallenges,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch public challenges");
    res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

/**
 * GET /api/challenges
 * Get all challenges with user progress
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const challenges = await Challenge.findAll({
      attributes: [
        "id",
        "title",
        "description",
        "difficulty",
        "points",
        "category",
        "created_at",
        [
          literal(`(CASE WHEN solves.id IS NOT NULL THEN 1 ELSE 0 END)`),
          "solved",
        ],
        [fn("COUNT", col("attempts.id")), "attempts"],
      ],
      include: [
        {
          model: Solve,
          as: "solves",
          attributes: [],
          where: { user_id: userId },
          required: false,
        },
        {
          model: Attempt,
          as: "attempts",
          attributes: [],
          where: { user_id: userId },
          required: false,
        },
      ],
      group: ["Challenge.id", "solves.id"],
      order: [["id", "ASC"]],
      subQuery: false,
    });

    res.json({ challenges });
  } catch (error) {
    logger.error({ error }, "Failed to fetch challenges");
    res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

/**
 * GET /api/challenges/:id
 * Get a specific challenge with user progress
 */
router.get(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const challengeId = parseInt(req.params.id);

      if (isNaN(challengeId)) {
        return res.status(400).json({ error: "Invalid challenge ID" });
      }

      // Get challenge
      const challenge = await Challenge.findByPk(challengeId, {
        attributes: [
          "id",
          "title",
          "description",
          "difficulty",
          "points",
          "category",
          "created_at",
        ],
      });

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      // Check if user solved it
      const solve = await Solve.findOne({
        where: {
          user_id: userId,
          challenge_id: challengeId,
        },
      });

      // Count user's attempts
      const attemptsCount = await Attempt.count({
        where: {
          user_id: userId,
          challenge_id: challengeId,
        },
      });

      // Build response
      const challengeWithProgress = {
        ...challenge.toJSON(),
        solved: solve ? 1 : 0,
        attempts: attemptsCount,
      };

      res.json({ challenge: challengeWithProgress });
    } catch (error) {
      logger.error({ error }, "Failed to fetch challenge");
      res.status(500).json({ error: "Failed to fetch challenge" });
    }
  },
);

/**
 * GET /api/challenges/:id/solution
 * Get challenge solution
 */
router.get(
  "/:id/solution",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const challengeId = parseInt(req.params.id);

      if (isNaN(challengeId)) {
        return res.status(400).json({ error: "Invalid challenge ID" });
      }

      // Get the solution
      const challenge = await Challenge.findByPk(challengeId, {
        attributes: ["solution"],
      });

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      if (!challenge.solution) {
        return res
          .status(404)
          .json({ error: "No solution available for this challenge" });
      }

      res.json({ solution: challenge.solution });
    } catch (error) {
      logger.error({ error }, "Failed to fetch solution");
      res.status(500).json({ error: "Failed to fetch solution" });
    }
  },
);

/**
 * GET /api/challenges/stats/overview
 * Get challenge statistics
 */
router.get("/stats/overview", authenticateToken, async (req, res) => {
  try {
    const totalChallenges = await Challenge.count();

    const easyChallenges = await Challenge.count({
      where: { difficulty: "easy" },
    });

    const mediumChallenges = await Challenge.count({
      where: { difficulty: "medium" },
    });

    const hardChallenges = await Challenge.count({
      where: { difficulty: "hard" },
    });

    const totalSolves = await Solve.count({
      distinct: true,
      col: "challenge_id",
    });

    const totalSolvers = await Solve.count({
      distinct: true,
      col: "user_id",
    });

    const stats = {
      total_challenges: totalChallenges,
      easy_challenges: easyChallenges,
      medium_challenges: mediumChallenges,
      hard_challenges: hardChallenges,
      total_solves: totalSolves,
      total_solvers: totalSolvers,
    };

    res.json({ stats });
  } catch (error) {
    logger.error({ error }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
