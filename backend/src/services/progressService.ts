import { sequelize } from "../db/database.js";
import { logger } from "../utils/logger.js";
import { Sequelize } from "sequelize";
import { Attempt, Solve, Challenge } from "../models/index.js";

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
      await Attempt.create({
        user_id: userId,
        challenge_id: challengeId,
        success,
      });

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
      // Use findOrCreate to handle duplicates gracefully
      const [solve, created] = await Solve.findOrCreate({
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
        logger.info({ userId, challengeId }, "Solve recorded");
      } else {
        logger.debug({ userId, challengeId }, "Challenge already solved");
      }
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
      await Attempt.create(
        {
          user_id: userId,
          challenge_id: challengeId,
          success,
        },
        { transaction },
      );

      // Record solve if successful and not already solved
      if (success && !alreadySolved) {
        // Use findOrCreate to avoid unique constraint errors
        const [solve, created] = await Solve.findOrCreate({
          where: {
            user_id: userId,
            challenge_id: challengeId,
          },
          defaults: {
            user_id: userId,
            challenge_id: challengeId,
          },
          transaction,
        });

        if (created) {
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
      const solve = await Solve.findOne({
        where: {
          user_id: userId,
          challenge_id: challengeId,
        },
      });

      return solve !== null;
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
      const challenge = await Challenge.findByPk(challengeId, {
        attributes: ["points"],
      });

      return challenge ? challenge.points : 0;
    } catch (error) {
      logger.error({ error, challengeId }, "Failed to get challenge points");
      throw error;
    }
  }
}

export const progressService = new ProgressService();
