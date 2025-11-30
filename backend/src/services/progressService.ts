import { sequelize } from "../db/database.js";
import { logger } from "../utils/logger.js";
import { QueryTypes, Sequelize } from "sequelize";

export class ProgressService {
  private db: Sequelize;

  constructor(database?: Sequelize) {
    this.db = database || sequelize;
  }

  /**
   * Record an attempt for a challenge
   */
  async recordAttempt(
    userId: number,
    challengeId: number,
    success: boolean,
  ): Promise<void> {
    try {
      await this.db.query(
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
   * Record a solve for a challenge
   */
  async recordSolve(userId: number, challengeId: number): Promise<void> {
    try {
      // Check if already solved
      const existing = await this.db.query(
        "SELECT id FROM solves WHERE user_id = ? AND challenge_id = ?",
        {
          replacements: [userId, challengeId],
          type: QueryTypes.SELECT,
        },
      );

      if (existing.length > 0) {
        logger.debug({ userId, challengeId }, "Challenge already solved");
        return;
      }

      await this.db.query(
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
   * Record validation result and update progress
   */
  async recordValidation(
    userId: number,
    challengeId: number,
    success: boolean,
    alreadySolved: boolean,
  ): Promise<void> {
    const transaction = await this.db.transaction();

    try {
      // Record attempt
      await this.db.query(
        "INSERT INTO attempts (user_id, challenge_id, success) VALUES (?, ?, ?)",
        {
          replacements: [userId, challengeId, success ? 1 : 0],
          type: QueryTypes.INSERT,
          transaction,
        },
      );

      // Record solve if successful and not already solved
      if (success && !alreadySolved) {
        const existing = await this.db.query(
          "SELECT id FROM solves WHERE user_id = ? AND challenge_id = ?",
          {
            replacements: [userId, challengeId],
            type: QueryTypes.SELECT,
            transaction,
          },
        );

        if (existing.length === 0) {
          await this.db.query(
            "INSERT INTO solves (user_id, challenge_id) VALUES (?, ?)",
            {
              replacements: [userId, challengeId],
              type: QueryTypes.INSERT,
              transaction,
            },
          );

          logger.info({ userId, challengeId }, "New solve recorded");
        }
      }

      await transaction.commit();
      logger.debug({ userId, challengeId, success }, "Validation recorded");
    } catch (error) {
      await transaction.rollback();
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
    try {
      const result = await this.db.query(
        "SELECT id FROM solves WHERE user_id = ? AND challenge_id = ?",
        {
          replacements: [userId, challengeId],
          type: QueryTypes.SELECT,
        },
      );

      return result.length > 0;
    } catch (error) {
      logger.error(
        { error, userId, challengeId },
        "Failed to check solve status",
      );
      throw error;
    }
  }

  /**
   * Get challenge points
   */
  async getChallengePoints(challengeId: number): Promise<number> {
    try {
      const result = (await this.db.query(
        "SELECT points FROM challenges WHERE id = ?",
        {
          replacements: [challengeId],
          type: QueryTypes.SELECT,
        },
      )) as Array<{ points: number }>;

      return result.length > 0 ? result[0].points : 0;
    } catch (error) {
      logger.error({ error, challengeId }, "Failed to get challenge points");
      throw error;
    }
  }
}

export const progressService = new ProgressService();
