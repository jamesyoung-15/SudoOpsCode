import fs from "fs";
import path from "path";
import yaml from "yaml";
import { sequelize } from "../db/database.js";
import { logger } from "../utils/logger.js";
import { ChallengeMetadata } from "../types/challenge.js";
import { config } from "../config/index.js";
import { QueryTypes } from "sequelize";

export class ChallengeLoader {
  private readonly CHALLENGES_DIR = path.join(config.docker.challengesPath);
  private readonly REQUIRED_FILES = ["challenge.yaml", "validate.sh"];

  /**
   * Load all challenges from the challenges directory
   */
  async loadChallenges(): Promise<void> {
    logger.info({ dir: this.CHALLENGES_DIR }, "Loading challenges...");

    if (!fs.existsSync(this.CHALLENGES_DIR)) {
      logger.warn("Challenges directory does not exist, creating...");
      fs.mkdirSync(this.CHALLENGES_DIR, { recursive: true });
      return;
    }

    const entries = fs.readdirSync(this.CHALLENGES_DIR, {
      withFileTypes: true,
    });
    const challengeDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    let loaded = 0;
    let failed = 0;

    for (const dirName of challengeDirs) {
      try {
        await this.loadChallenge(dirName);
        loaded++;
      } catch (error) {
        failed++;
        logger.error({ error, directory: dirName }, "Failed to load challenge");
      }
    }

    logger.info(
      { loaded, failed, total: challengeDirs.length },
      "Challenges loaded",
    );
  }

  /**
   * Load a single challenge
   */
  private async loadChallenge(dirName: string): Promise<void> {
    const challengePath = path.join(this.CHALLENGES_DIR, dirName);

    // Validate directory structure
    this.validateChallengeDirectory(challengePath, dirName);

    // Parse challenge.yaml
    const metadata = this.parseChallengeMetadata(challengePath, dirName);

    // Validate metadata
    this.validateMetadata(metadata, dirName);

    // Insert or update challenge in database
    await this.upsertChallenge(metadata, dirName);

    logger.debug(
      { directory: dirName, title: metadata.title },
      "Challenge loaded",
    );
  }

  /**
   * Validate challenge directory structure
   */
  private validateChallengeDirectory(
    challengePath: string,
    dirName: string,
  ): void {
    for (const file of this.REQUIRED_FILES) {
      const filePath = path.join(challengePath, file);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing required file: ${file} in ${dirName}`);
      }

      // Check if validate.sh is executable (on Unix systems)
      if (file === "validate.sh" && process.platform !== "win32") {
        const stats = fs.statSync(filePath);
        const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;

        if (!isExecutable) {
          logger.warn(
            { directory: dirName },
            "validate.sh is not executable, fixing...",
          );
          fs.chmodSync(filePath, "755");
        }
      }
    }

    // Check for optional setup.sh
    const setupPath = path.join(challengePath, "setup.sh");
    if (fs.existsSync(setupPath) && process.platform !== "win32") {
      const stats = fs.statSync(setupPath);
      const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;

      if (!isExecutable) {
        logger.warn(
          { directory: dirName },
          "setup.sh is not executable, fixing...",
        );
        fs.chmodSync(setupPath, "755");
      }
    }
  }

  /**
   * Parse challenge.yaml file
   */
  private parseChallengeMetadata(
    challengePath: string,
    dirName: string,
  ): ChallengeMetadata {
    const yamlPath = path.join(challengePath, "challenge.yaml");
    const yamlContent = fs.readFileSync(yamlPath, "utf-8");

    try {
      const metadata = yaml.parse(yamlContent) as ChallengeMetadata;
      return metadata;
    } catch (error) {
      throw new Error(`Invalid YAML in ${dirName}/challenge.yaml: ${error}`);
    }
  }

  /**
   * Validate challenge metadata
   */
  private validateMetadata(metadata: ChallengeMetadata, dirName: string): void {
    const errors: string[] = [];

    if (!metadata.title || typeof metadata.title !== "string") {
      errors.push("title is required and must be a string");
    }

    if (!metadata.description || typeof metadata.description !== "string") {
      errors.push("description is required and must be a string");
    }

    if (!["easy", "medium", "hard"].includes(metadata.difficulty)) {
      errors.push("difficulty must be one of: easy, medium, hard");
    }

    if (
      !metadata.points ||
      typeof metadata.points !== "number" ||
      metadata.points <= 0
    ) {
      errors.push("points is required and must be a positive number");
    }

    if (!metadata.category || typeof metadata.category !== "string") {
      errors.push("category is required and must be a string");
    }

    if (
      metadata.solution !== undefined &&
      typeof metadata.solution !== "string"
    ) {
      errors.push("solution must be a string if provided");
    }

    if (errors.length > 0) {
      throw new Error(`Invalid metadata in ${dirName}: ${errors.join(", ")}`);
    }
  }

  /**
   * Insert or update challenge in database
   */
  private async upsertChallenge(
    metadata: ChallengeMetadata,
    dirName: string,
  ): Promise<void> {
    const existing = (await sequelize.query(
      "SELECT id FROM challenges WHERE directory = ?",
      {
        replacements: [dirName],
        type: QueryTypes.SELECT,
      },
    )) as { id: number }[];

    if (existing.length > 0) {
      // Update existing challenge
      await sequelize.query(
        `UPDATE challenges 
         SET title = ?, description = ?, difficulty = ?, points = ?, category = ?, solution = ?
         WHERE directory = ?`,
        {
          replacements: [
            metadata.title,
            metadata.description,
            metadata.difficulty,
            metadata.points,
            metadata.category,
            metadata.solution || null,
            dirName,
          ],
          type: QueryTypes.UPDATE,
        },
      );

      logger.debug(
        { directory: dirName, id: existing[0].id },
        "Challenge updated",
      );
    } else {
      // Insert new challenge
      await sequelize.query(
        `INSERT INTO challenges (title, description, difficulty, points, category, solution, directory)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        {
          replacements: [
            metadata.title,
            metadata.description,
            metadata.difficulty,
            metadata.points,
            metadata.category,
            metadata.solution || null,
            dirName,
          ],
          type: QueryTypes.INSERT,
        },
      );

      logger.debug({ directory: dirName }, "Challenge inserted");
    }
  }

  /**
   * Get challenge directory path by ID
   */
  async getChallengeDirectory(challengeId: number): Promise<string> {
    const challenge = (await sequelize.query(
      "SELECT directory FROM challenges WHERE id = ?",
      {
        replacements: [challengeId],
        type: QueryTypes.SELECT,
      },
    )) as { directory: string }[];

    if (challenge.length === 0) {
      throw new Error(`Challenge not found: ${challengeId}`);
    }

    return path.join(this.CHALLENGES_DIR, challenge[0].directory);
  }
}

export const challengeLoader = new ChallengeLoader();
