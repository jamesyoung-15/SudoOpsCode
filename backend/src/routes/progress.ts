import { Router, Response } from "express";
import { sequelize } from "../db/database.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";
import { QueryTypes } from "sequelize";

const router = Router();

/**
 * GET /api/progress
 * Get current user's progress
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get overall stats
    const overallStats = await sequelize.query(
      `SELECT 
        COUNT(DISTINCT c.id) as total_challenges,
        COUNT(DISTINCT s.challenge_id) as solved_challenges,
        COALESCE(SUM(CASE WHEN s.challenge_id IS NOT NULL THEN c.points ELSE 0 END), 0) as total_points,
        COUNT(DISTINCT a.id) as total_attempts
      FROM challenges c
      LEFT JOIN solves s ON c.id = s.challenge_id AND s.user_id = ?
      LEFT JOIN attempts a ON c.id = a.challenge_id AND a.user_id = ?`,
      {
        replacements: [userId, userId],
        type: QueryTypes.SELECT,
      }
    ) as Array<{
      total_challenges: number;
      solved_challenges: number;
      total_points: number;
      total_attempts: number;
    }>;

    // Get progress by difficulty
    const difficultyStats = await sequelize.query(
      `SELECT 
        c.difficulty,
        COUNT(DISTINCT c.id) as total,
        COUNT(DISTINCT s.challenge_id) as solved,
        COALESCE(SUM(CASE WHEN s.challenge_id IS NOT NULL THEN c.points ELSE 0 END), 0) as points
      FROM challenges c
      LEFT JOIN solves s ON c.id = s.challenge_id AND s.user_id = ?
      GROUP BY c.difficulty
      ORDER BY 
        CASE c.difficulty 
          WHEN 'easy' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'hard' THEN 3 
        END`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      }
    ) as Array<{
      difficulty: string;
      total: number;
      solved: number;
      points: number;
    }>;

    // Get progress by category
    const categoryStats = await sequelize.query(
      `SELECT 
        c.category,
        COUNT(DISTINCT c.id) as total,
        COUNT(DISTINCT s.challenge_id) as solved,
        COALESCE(SUM(CASE WHEN s.challenge_id IS NOT NULL THEN c.points ELSE 0 END), 0) as points
      FROM challenges c
      LEFT JOIN solves s ON c.id = s.challenge_id AND s.user_id = ?
      GROUP BY c.category
      ORDER BY c.category`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      }
    ) as Array<{
      category: string;
      total: number;
      solved: number;
      points: number;
    }>;

    // Get recent solves
    const recentSolves = await sequelize.query(
      `SELECT 
        c.id,
        c.title,
        c.difficulty,
        c.category,
        c.points,
        s.solved_at
      FROM solves s
      JOIN challenges c ON s.challenge_id = c.id
      WHERE s.user_id = ?
      ORDER BY s.solved_at DESC
      LIMIT 10`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      }
    ) as Array<{
      id: number;
      title: string;
      difficulty: string;
      category: string;
      points: number;
      solved_at: string;
    }>;

    // Calculate accuracy
    const accuracyStats = await sequelize.query(
      `SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_attempts
      FROM attempts
      WHERE user_id = ?`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      }
    ) as Array<{
      total_attempts: number;
      successful_attempts: number;
    }>;

    const accuracy =
      accuracyStats[0].total_attempts > 0
        ? (accuracyStats[0].successful_attempts / accuracyStats[0].total_attempts) * 100
        : 0;

    res.json({
      overall: {
        ...overallStats[0],
        accuracy: Math.round(accuracy * 100) / 100,
      },
      byDifficulty: difficultyStats,
      byCategory: categoryStats,
      recentSolves,
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch user progress");
    res.status(500).json({ error: "Failed to fetch user progress" });
  }
});

/**
 * GET /api/progress/history
 * Get user's solve history with pagination
 */
router.get("/history", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get total count
    const totalCount = await sequelize.query(
      `SELECT COUNT(*) as count
      FROM solves
      WHERE user_id = ?`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      }
    ) as Array<{ count: number }>;

    // Get paginated history
    const history = await sequelize.query(
      `SELECT 
        c.id,
        c.title,
        c.difficulty,
        c.category,
        c.points,
        s.solved_at,
        (
          SELECT COUNT(*)
          FROM attempts a
          WHERE a.user_id = ? AND a.challenge_id = c.id
        ) as attempts_before_solve
      FROM solves s
      JOIN challenges c ON s.challenge_id = c.id
      WHERE s.user_id = ?
      ORDER BY s.solved_at DESC
      LIMIT ? OFFSET ?`,
      {
        replacements: [userId, userId, limit, offset],
        type: QueryTypes.SELECT,
      }
    ) as Array<{
      id: number;
      title: string;
      difficulty: string;
      category: string;
      points: number;
      solved_at: string;
      attempts_before_solve: number;
    }>;

    res.json({
      history,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch solve history");
    res.status(500).json({ error: "Failed to fetch solve history" });
  }
});

/**
 * GET /api/progress/streak
 * Get user's solve streak information
 */
router.get("/streak", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get all solve dates
    const solves = await sequelize.query(
      `SELECT DATE(solved_at) as solve_date
      FROM solves
      WHERE user_id = ?
      ORDER BY solved_at DESC`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      }
    ) as Array<{ solve_date: string }>;

    if (solves.length === 0) {
      return res.json({
        currentStreak: 0,
        longestStreak: 0,
        lastSolveDate: null,
      });
    }

    // Calculate current and longest streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastSolve = new Date(solves[0].solve_date);
    lastSolve.setHours(0, 0, 0, 0);

    // Check if current streak is active
    const daysSinceLastSolve = Math.floor(
      (today.getTime() - lastSolve.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceLastSolve <= 1) {
      currentStreak = 1;

      // Count consecutive days
      for (let i = 1; i < solves.length; i++) {
        const currentDate = new Date(solves[i - 1].solve_date);
        const prevDate = new Date(solves[i].solve_date);
        currentDate.setHours(0, 0, 0, 0);
        prevDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor(
          (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (diffDays === 1) {
          currentStreak++;
        } else if (diffDays === 0) {
          continue;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    for (let i = 1; i < solves.length; i++) {
      const currentDate = new Date(solves[i - 1].solve_date);
      const prevDate = new Date(solves[i].solve_date);
      currentDate.setHours(0, 0, 0, 0);
      prevDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays === 0) {
        continue;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    res.json({
      currentStreak,
      longestStreak,
      lastSolveDate: solves[0].solve_date,
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch streak data");
    res.status(500).json({ error: "Failed to fetch streak data" });
  }
});

/**
 * GET /api/progress/activity
 * Get user's activity data for visualization
 */
router.get("/activity", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const days = parseInt(req.query.days as string) || 30;

    const activity = await sequelize.query(
      `SELECT 
        DATE(solved_at) as date,
        COUNT(*) as solves,
        SUM(c.points) as points
      FROM solves s
      JOIN challenges c ON s.challenge_id = c.id
      WHERE s.user_id = ? 
        AND solved_at >= datetime('now', '-' || ? || ' days')
      GROUP BY DATE(solved_at)
      ORDER BY date DESC`,
      {
        replacements: [userId, days],
        type: QueryTypes.SELECT,
      }
    ) as Array<{
      date: string;
      solves: number;
      points: number;
    }>;

    res.json({ activity, days });
  } catch (error) {
    logger.error({ error }, "Failed to fetch activity data");
    res.status(500).json({ error: "Failed to fetch activity data" });
  }
});

export default router;