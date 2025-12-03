import { ChallengeLoader } from "../services/challengeLoader.js";
import { Challenge } from "../models/Challenge.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  initTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  testSequelize,
} from "./setup.js";

describe("ChallengeLoader", () => {
  let challengeLoader: ChallengeLoader;
  let tempDir: string;

  beforeAll(async () => {
    await initTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();

    // Create temporary directory for test challenges
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "challenges-test-"));
    challengeLoader = new ChallengeLoader(testSequelize, tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  const createTestChallenge = async (
    dirName: string,
    metadata: any
  ): Promise<void> => {
    const challengePath = path.join(tempDir, dirName);
    await fs.mkdir(challengePath, { recursive: true });

    // Create challenge.yaml
    const yaml = `
title: ${metadata.title}
description: ${metadata.description}
difficulty: ${metadata.difficulty}
points: ${metadata.points}
category: ${metadata.category}
${metadata.solution ? `solution: ${metadata.solution}` : ""}
`.trim();

    await fs.writeFile(path.join(challengePath, "challenge.yaml"), yaml);

    // Create validate.sh
    await fs.writeFile(
      path.join(challengePath, "validate.sh"),
      "#!/bin/bash\necho 'valid'\n"
    );
    await fs.chmod(path.join(challengePath, "validate.sh"), "755");
  };

  describe("loadChallenges", () => {
    it("should load valid challenges", async () => {
      await createTestChallenge("test-challenge-1", {
        title: "Test Challenge 1",
        description: "First test challenge",
        difficulty: "easy",
        points: 100,
        category: "test",
      });

      await createTestChallenge("test-challenge-2", {
        title: "Test Challenge 2",
        description: "Second test challenge",
        difficulty: "medium",
        points: 200,
        category: "test",
      });

      await challengeLoader.loadChallenges();

      const challenges = await Challenge.findAll();
      expect(challenges).toHaveLength(2);

      const challenge1 = challenges.find((c) => c.directory === "test-challenge-1");
      expect(challenge1).toBeDefined();
      expect(challenge1!.title).toBe("Test Challenge 1");
      expect(challenge1!.difficulty).toBe("easy");
      expect(challenge1!.points).toBe(100);

      const challenge2 = challenges.find((c) => c.directory === "test-challenge-2");
      expect(challenge2).toBeDefined();
      expect(challenge2!.title).toBe("Test Challenge 2");
      expect(challenge2!.difficulty).toBe("medium");
      expect(challenge2!.points).toBe(200);
    });

    it("should update existing challenges", async () => {
      // Create initial challenge
      await createTestChallenge("test-challenge", {
        title: "Original Title",
        description: "Original description",
        difficulty: "easy",
        points: 100,
        category: "test",
      });

      await challengeLoader.loadChallenges();

      let challenge = await Challenge.findOne({
        where: { directory: "test-challenge" },
      });
      expect(challenge!.title).toBe("Original Title");
      expect(challenge!.points).toBe(100);

      // Update challenge
      await createTestChallenge("test-challenge", {
        title: "Updated Title",
        description: "Updated description",
        difficulty: "hard",
        points: 300,
        category: "test",
      });

      await challengeLoader.loadChallenges();

      challenge = await Challenge.findOne({
        where: { directory: "test-challenge" },
      });
      expect(challenge!.title).toBe("Updated Title");
      expect(challenge!.points).toBe(300);
      expect(challenge!.difficulty).toBe("hard");
    });

    it("should handle challenges with solution", async () => {
      await createTestChallenge("test-challenge", {
        title: "Test Challenge",
        description: "Test description",
        difficulty: "easy",
        points: 100,
        category: "test",
        solution: "Test solution",
      });

      await challengeLoader.loadChallenges();

      const challenge = await Challenge.findOne({
        where: { directory: "test-challenge" },
      });
      expect(challenge!.solution).toBe("Test solution");
    });

    it("should skip invalid challenges", async () => {
      // Valid challenge
      await createTestChallenge("valid-challenge", {
        title: "Valid Challenge",
        description: "Valid description",
        difficulty: "easy",
        points: 100,
        category: "test",
      });

      // Invalid challenge (missing validate.sh)
      const invalidPath = path.join(tempDir, "invalid-challenge");
      await fs.mkdir(invalidPath, { recursive: true });
      await fs.writeFile(
        path.join(invalidPath, "challenge.yaml"),
        "title: Invalid\ndescription: Missing validate.sh\ndifficulty: easy\npoints: 100\ncategory: test\n"
      );

      await challengeLoader.loadChallenges();

      const challenges = await Challenge.findAll();
      expect(challenges).toHaveLength(1);
      expect(challenges[0].directory).toBe("valid-challenge");
    });
  });

  describe("getChallengeDirectory", () => {
    it("should return correct directory path", async () => {
      await createTestChallenge("test-challenge", {
        title: "Test Challenge",
        description: "Test description",
        difficulty: "easy",
        points: 100,
        category: "test",
      });

      await challengeLoader.loadChallenges();

      const challenge = await Challenge.findOne({
        where: { directory: "test-challenge" },
      });

      const dirPath = await challengeLoader.getChallengeDirectory(challenge!.id);
      expect(dirPath).toBe(path.join(tempDir, "test-challenge"));
    });

    it("should throw error for non-existent challenge", async () => {
      await expect(
        challengeLoader.getChallengeDirectory(99999)
      ).rejects.toThrow("Challenge not found");
    });
  });
});