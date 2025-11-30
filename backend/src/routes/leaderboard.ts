import { Router, Response } from "express";
import { sequelize } from "../db/database.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";
import { QueryTypes } from "sequelize";

const router = Router();

/**
 * GET /api/leaderboard
 * Get global leaderboard
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // Get total users count
    const totalCount = (await sequelize.query(
      `SELECT COUNT(*) as count FROM users`,
      {
        type: QueryTypes.SELECT,
      },
    )) as Array<{ count: number }>;

    // Get leaderboard with user stats
    const leaderboard = (await sequelize.query(
      `SELECT 
        u.id,
        u.username,
        COALESCE(SUM(c.points), 0) as total_points,
        COUNT(DISTINCT s.challenge_id) as challenges_solved,
        COUNT(DISTINCT a.id) as total_attempts,
        MAX(s.solved_at) as last_solve_date,
        u.created_at
      FROM users u
      LEFT JOIN solves s ON u.id = s.user_id
      LEFT JOIN challenges c ON s.challenge_id = c.id
      LEFT JOIN attempts a ON u.id = a.user_id
      GROUP BY u.id, u.username, u.created_at
      ORDER BY total_points DESC, challenges_solved DESC, last_solve_date ASC
      LIMIT ? OFFSET ?`,
      {
        replacements: [limit, offset],
        type: QueryTypes.SELECT,
      },
    )) as Array<{
      id: number;
      username: string;
      total_points: number;
      challenges_solved: number;
      total_attempts: number;
      last_solve_date: string | null;
      created_at: string;
    }>;

    // Add rank to each user
    const rankedLeaderboard = leaderboard.map((user, index) => ({
      rank: offset + index + 1,
      ...user,
    }));

    res.json({
      leaderboard: rankedLeaderboard,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch leaderboard");
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

/**
 * GET /api/leaderboard/me
 * Get current user's rank and nearby users
 */
router.get(
  "/me",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const context = parseInt(req.query.context as string) || 5;

      // Get user's stats
      const userStats = (await sequelize.query(
        `SELECT 
        u.id,
        u.username,
        COALESCE(SUM(c.points), 0) as total_points,
        COUNT(DISTINCT s.challenge_id) as challenges_solved,
        COUNT(DISTINCT a.id) as total_attempts,
        MAX(s.solved_at) as last_solve_date
      FROM users u
      LEFT JOIN solves s ON u.id = s.user_id
      LEFT JOIN challenges c ON s.challenge_id = c.id
      LEFT JOIN attempts a ON u.id = a.user_id
      WHERE u.id = ?
      GROUP BY u.id, u.username`,
        {
          replacements: [userId],
          type: QueryTypes.SELECT,
        },
      )) as Array<{
        id: number;
        username: string;
        total_points: number;
        challenges_solved: number;
        total_attempts: number;
        last_solve_date: string | null;
      }>;

      if (userStats.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userStats[0];

      // Calculate user's rank
      const rankResult = (await sequelize.query(
        `SELECT COUNT(*) + 1 as rank
      FROM (
        SELECT 
          u.id,
          COALESCE(SUM(c.points), 0) as total_points,
          COUNT(DISTINCT s.challenge_id) as challenges_solved,
          MAX(s.solved_at) as last_solve_date
        FROM users u
        LEFT JOIN solves s ON u.id = s.user_id
        LEFT JOIN challenges c ON s.challenge_id = c.id
        GROUP BY u.id
      ) ranked
      WHERE 
        total_points > ? 
        OR (total_points = ? AND challenges_solved > ?)
        OR (total_points = ? AND challenges_solved = ? AND last_solve_date < ?)`,
        {
          replacements: [
            user.total_points,
            user.total_points,
            user.challenges_solved,
            user.total_points,
            user.challenges_solved,
            user.last_solve_date || "9999-12-31",
          ],
          type: QueryTypes.SELECT,
        },
      )) as Array<{ rank: number }>;

      const userRank = rankResult[0].rank;

      // Get nearby users
      const nearbyUsers = (await sequelize.query(
        `WITH RankedUsers AS (
        SELECT 
          u.id,
          u.username,
          COALESCE(SUM(c.points), 0) as total_points,
          COUNT(DISTINCT s.challenge_id) as challenges_solved,
          COUNT(DISTINCT a.id) as total_attempts,
          MAX(s.solved_at) as last_solve_date,
          ROW_NUMBER() OVER (
            ORDER BY 
              COALESCE(SUM(c.points), 0) DESC,
              COUNT(DISTINCT s.challenge_id) DESC,
              MAX(s.solved_at) ASC
          ) as rank
        FROM users u
        LEFT JOIN solves s ON u.id = s.user_id
        LEFT JOIN challenges c ON s.challenge_id = c.id
        LEFT JOIN attempts a ON u.id = a.user_id
        GROUP BY u.id, u.username
      )
      SELECT *
      FROM RankedUsers
      WHERE rank BETWEEN ? AND ?
      ORDER BY rank`,
        {
          replacements: [Math.max(1, userRank - context), userRank + context],
          type: QueryTypes.SELECT,
        },
      )) as Array<{
        id: number;
        username: string;
        total_points: number;
        challenges_solved: number;
        total_attempts: number;
        last_solve_date: string | null;
        rank: number;
      }>;

      res.json({
        user: {
          ...user,
          rank: userRank,
        },
        nearby: nearbyUsers,
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch user rank");
      res.status(500).json({ error: "Failed to fetch user rank" });
    }
  },
);

/**
 * GET /api/leaderboard/top/:difficulty
 * Get leaderboard filtered by difficulty
 */
router.get(
  "/top/:difficulty",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { difficulty } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!["easy", "medium", "hard"].includes(difficulty)) {
        return res.status(400).json({ error: "Invalid difficulty" });
      }

      const leaderboard = (await sequelize.query(
        `SELECT 
        u.id,
        u.username,
        COALESCE(SUM(c.points), 0) as points,
        COUNT(DISTINCT s.challenge_id) as challenges_solved
      FROM users u
      LEFT JOIN solves s ON u.id = s.user_id
      LEFT JOIN challenges c ON s.challenge_id = c.id AND c.difficulty = ?
      GROUP BY u.id, u.username
      HAVING challenges_solved > 0
      ORDER BY points DESC, challenges_solved DESC
      LIMIT ?`,
        {
          replacements: [difficulty, limit],
          type: QueryTypes.SELECT,
        },
      )) as Array<{
        id: number;
        username: string;
        points: number;
        challenges_solved: number;
      }>;

      const rankedLeaderboard = leaderboard.map((user, index) => ({
        rank: index + 1,
        ...user,
      }));

      res.json({
        difficulty,
        leaderboard: rankedLeaderboard,
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch difficulty leaderboard");
      res.status(500).json({ error: "Failed to fetch difficulty leaderboard" });
    }
  },
);

/**
 * GET /api/leaderboard/category/:category
 * Get leaderboard filtered by category
 */
router.get(
  "/category/:category",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { category } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const leaderboard = (await sequelize.query(
        `SELECT 
        u.id,
        u.username,
        COALESCE(SUM(c.points), 0) as points,
        COUNT(DISTINCT s.challenge_id) as challenges_solved
      FROM users u
      LEFT JOIN solves s ON u.id = s.user_id
      LEFT JOIN challenges c ON s.challenge_id = c.id AND c.category = ?
      GROUP BY u.id, u.username
      HAVING challenges_solved > 0
      ORDER BY points DESC, challenges_solved DESC
      LIMIT ?`,
        {
          replacements: [category, limit],
          type: QueryTypes.SELECT,
        },
      )) as Array<{
        id: number;
        username: string;
        points: number;
        challenges_solved: number;
      }>;

      const rankedLeaderboard = leaderboard.map((user, index) => ({
        rank: index + 1,
        ...user,
      }));

      res.json({
        category,
        leaderboard: rankedLeaderboard,
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch category leaderboard");
      res.status(500).json({ error: "Failed to fetch category leaderboard" });
    }
  },
);

export default router;
