import { Router, Response } from "express";
import { sequelize } from "../db/database.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { Challenge, ChallengeWithProgress } from "../types/challenge.js";
import { logger } from "../utils/logger.js";
import { QueryTypes } from "sequelize";

const router = Router();

/**
 * GET /api/challenges/public
 * Get all challenges (public, no auth required)
 */
router.get("/public", async (req, res) => {
  try {
    const challenges = (await sequelize.query(
      `SELECT 
        c.id,
        c.title,
        c.description,
        c.difficulty,
        c.points,
        c.category,
        c.created_at,
        COUNT(DISTINCT s.user_id) as solve_count
      FROM challenges c
      LEFT JOIN solves s ON c.id = s.challenge_id
      GROUP BY c.id
      ORDER BY c.id`,
      {
        type: QueryTypes.SELECT,
      },
    )) as Array<{
      id: number;
      title: string;
      description: string;
      difficulty: string;
      points: number;
      category: string;
      created_at: string;
      solve_count: number;
    }>;

    res.json({ challenges });
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

    const challenges = (await sequelize.query(
      `SELECT 
        c.id,
        c.title,
        c.description,
        c.difficulty,
        c.points,
        c.category,
        c.created_at,
        CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END as solved,
        COALESCE(a.attempt_count, 0) as attempts
      FROM challenges c
      LEFT JOIN solves s ON c.id = s.challenge_id AND s.user_id = ?
      LEFT JOIN (
        SELECT challenge_id, COUNT(*) as attempt_count
        FROM attempts
        WHERE user_id = ?
        GROUP BY challenge_id
      ) a ON c.id = a.challenge_id
      ORDER BY c.id`,
      {
        replacements: [userId, userId],
        type: QueryTypes.SELECT,
      },
    )) as ChallengeWithProgress[];

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

      const challenge = (await sequelize.query(
        `SELECT 
        c.id,
        c.title,
        c.description,
        c.difficulty,
        c.points,
        c.category,
        c.created_at,
        CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END as solved,
        COALESCE(a.attempt_count, 0) as attempts
      FROM challenges c
      LEFT JOIN solves s ON c.id = s.challenge_id AND s.user_id = ?
      LEFT JOIN (
        SELECT challenge_id, COUNT(*) as attempt_count
        FROM attempts
        WHERE user_id = ? AND challenge_id = ?
        GROUP BY challenge_id
      ) a ON c.id = a.challenge_id
      WHERE c.id = ?`,
        {
          replacements: [userId, userId, challengeId, challengeId],
          type: QueryTypes.SELECT,
        },
      )) as ChallengeWithProgress[];

      if (challenge.length === 0) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      res.json({ challenge: challenge[0] });
    } catch (error) {
      logger.error({ error }, "Failed to fetch challenge");
      res.status(500).json({ error: "Failed to fetch challenge" });
    }
  },
);

/**
 * GET /api/challenges/:id/solution
 * Get challenge solution (only if solved)
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

      // Check if user has solved the challenge
      const solve = await sequelize.query(
        "SELECT id FROM solves WHERE user_id = ? AND challenge_id = ?",
        {
          replacements: [userId, challengeId],
          type: QueryTypes.SELECT,
        },
      );

      if (solve.length === 0) {
        return res
          .status(403)
          .json({ error: "You must solve the challenge first" });
      }

      // Get the solution
      const challenge = (await sequelize.query(
        "SELECT solution FROM challenges WHERE id = ?",
        {
          replacements: [challengeId],
          type: QueryTypes.SELECT,
        },
      )) as Array<{ solution: string | null }>;

      if (challenge.length === 0) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      if (!challenge[0].solution) {
        return res
          .status(404)
          .json({ error: "No solution available for this challenge" });
      }

      res.json({ solution: challenge[0].solution });
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
    const stats = (await sequelize.query(
      `SELECT 
        COUNT(DISTINCT c.id) as total_challenges,
        COUNT(DISTINCT CASE WHEN c.difficulty = 'easy' THEN c.id END) as easy_challenges,
        COUNT(DISTINCT CASE WHEN c.difficulty = 'medium' THEN c.id END) as medium_challenges,
        COUNT(DISTINCT CASE WHEN c.difficulty = 'hard' THEN c.id END) as hard_challenges,
        COUNT(DISTINCT s.challenge_id) as total_solves,
        COUNT(DISTINCT s.user_id) as total_solvers
      FROM challenges c
      LEFT JOIN solves s ON c.id = s.challenge_id`,
      {
        type: QueryTypes.SELECT,
      },
    )) as Array<{
      total_challenges: number;
      easy_challenges: number;
      medium_challenges: number;
      hard_challenges: number;
      total_solves: number;
      total_solvers: number;
    }>;

    res.json({ stats: stats[0] });
  } catch (error) {
    logger.error({ error }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
