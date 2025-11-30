import { sequelize } from "../db/database.js";
import { logger } from "../utils/logger.js";
import { QueryTypes } from "sequelize";

export class ProgressService {
  /**
   * Record a solve attempt
   */
  async recordAttempt(
    userId: number,
    challengeId: number,
    success: boolean,
  ): Promise<void> {
    try {
      await sequelize.query(
        "INSERT INTO attempts (user_id, challenge_id, success) VALUES (?, ?, ?)",
        {
          replacements: [userId, challengeId, success ? 1 : 0],
          type: QueryTypes.INSERT,
        },
      );

      logger.debug({ userId, challengeId, success }, "Attempt recorded");
    } catch (error) {
      logger.error({ error, userId, challengeId }, "Failed to record attempt");
      throw error;
    }
  }

  /**
   * Record a successful solve
   */
  async recordSolve(userId: number, challengeId: number): Promise<void> {
    try {
      // Check if already solved
      const existingSolve = await sequelize.query(
        "SELECT id FROM solves WHERE user_id = ? AND challenge_id = ?",
        {
          replacements: [userId, challengeId],
          type: QueryTypes.SELECT,
        },
      );

      if (existingSolve.length > 0) {
        logger.debug({ userId, challengeId }, "Challenge already solved");
        return;
      }

      // Insert solve
      await sequelize.query(
        "INSERT INTO solves (user_id, challenge_id) VALUES (?, ?)",
        {
          replacements: [userId, challengeId],
          type: QueryTypes.INSERT,
        },
      );

      logger.info({ userId, challengeId }, "Solve recorded");
    } catch (error) {
      logger.error({ error, userId, challengeId }, "Failed to record solve");
      throw error;
    }
  }

  /**
   * Record validation result (attempt + solve if successful)
   */
  async recordValidation(
    userId: number,
    challengeId: number,
    success: boolean,
    alreadySolved = false,
  ): Promise<void> {
    const t = await sequelize.transaction();

    try {
      // Record attempt
      await sequelize.query(
        "INSERT INTO attempts (user_id, challenge_id, success) VALUES (?, ?, ?)",
        {
          replacements: [userId, challengeId, success ? 1 : 0],
          type: QueryTypes.INSERT,
          transaction: t,
        },
      );

      // Record solve if successful
      if (success && !alreadySolved) {
        const existingSolve = await sequelize.query(
          "SELECT id FROM solves WHERE user_id = ? AND challenge_id = ?",
          {
            replacements: [userId, challengeId],
            type: QueryTypes.SELECT,
            transaction: t,
          },
        );

        if (existingSolve.length === 0) {
          await sequelize.query(
            "INSERT INTO solves (user_id, challenge_id) VALUES (?, ?)",
            {
              replacements: [userId, challengeId],
              type: QueryTypes.INSERT,
              transaction: t,
            },
          );
        }
      }

      await t.commit();
      logger.debug({ userId, challengeId, success }, "Validation recorded");
    } catch (error) {
      await t.rollback();
      logger.error(
        { error, userId, challengeId },
        "Failed to record validation",
      );
      throw error;
    }
  }

  /**
   * Check if user has solved a challenge
   */
  async hasSolved(userId: number, challengeId: number): Promise<boolean> {
    const solve = await sequelize.query(
      "SELECT id FROM solves WHERE user_id = ? AND challenge_id = ?",
      {
        replacements: [userId, challengeId],
        type: QueryTypes.SELECT,
      },
    );

    return solve.length > 0;
  }

  /**
   * Get challenge points
   */
  async getChallengePoints(challengeId: number): Promise<number> {
    const challenge = (await sequelize.query(
      "SELECT points FROM challenges WHERE id = ?",
      {
        replacements: [challengeId],
        type: QueryTypes.SELECT,
      },
    )) as { points: number }[];

    return challenge[0]?.points || 0;
  }
}

export const progressService = new ProgressService();
