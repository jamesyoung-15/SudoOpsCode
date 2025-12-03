import { ProgressService } from "../services/progressService.js";
import { User } from "../models/User.js";
import { Challenge } from "../models/Challenge.js";
import { Solve } from "../models/Solve.js";
import { Attempt } from "../models/Attempt.js";
import {
  initTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  testSequelize,
} from "./setup.js";

describe("ProgressService", () => {
  let progressService: ProgressService;
  let testUser: User;
  let testChallenge: Challenge;

  beforeAll(async () => {
    await initTestDatabase();
    progressService = new ProgressService(testSequelize);
  });

  beforeEach(async () => {
    await cleanTestDatabase();

    // Create test user
    testUser = await User.create({
      username: "testuser",
      password: "hashedpassword",
    });

    // Create test challenge
    testChallenge = await Challenge.create({
      title: "Test Challenge",
      description: "A test challenge",
      difficulty: "easy",
      points: 100,
      category: "test",
      directory: "test-challenge",
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe("recordAttempt", () => {
    it("should record a successful attempt", async () => {
      await progressService.recordAttempt(testUser.id, testChallenge.id, true);

      const attempts = await Attempt.findAll({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      expect(attempts).toHaveLength(1);
      expect(attempts[0].success).toBe(true);
    });

    it("should record a failed attempt", async () => {
      await progressService.recordAttempt(testUser.id, testChallenge.id, false);

      const attempts = await Attempt.findAll({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      expect(attempts).toHaveLength(1);
      expect(attempts[0].success).toBe(false);
    });

    it("should record multiple attempts", async () => {
      await progressService.recordAttempt(testUser.id, testChallenge.id, false);
      await progressService.recordAttempt(testUser.id, testChallenge.id, false);
      await progressService.recordAttempt(testUser.id, testChallenge.id, true);

      const attempts = await Attempt.findAll({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      expect(attempts).toHaveLength(3);
      expect(attempts.filter((a) => a.success)).toHaveLength(1);
      expect(attempts.filter((a) => !a.success)).toHaveLength(2);
    });
  });

  describe("recordSolve", () => {
    it("should record a solve", async () => {
      await progressService.recordSolve(testUser.id, testChallenge.id);

      const solve = await Solve.findOne({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      expect(solve).not.toBeNull();
      expect(solve!.user_id).toBe(testUser.id);
      expect(solve!.challenge_id).toBe(testChallenge.id);
    });

    it("should not create duplicate solves", async () => {
      await progressService.recordSolve(testUser.id, testChallenge.id);
      await progressService.recordSolve(testUser.id, testChallenge.id);

      const solves = await Solve.findAll({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      expect(solves).toHaveLength(1);
    });
  });

  describe("recordValidation", () => {
    it("should record attempt and solve for successful validation", async () => {
      await progressService.recordValidation(
        testUser.id,
        testChallenge.id,
        true,
        false
      );

      const attempt = await Attempt.findOne({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      const solve = await Solve.findOne({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      expect(attempt).not.toBeNull();
      expect(attempt!.success).toBe(true);
      expect(solve).not.toBeNull();
    });

    it("should only record attempt for failed validation", async () => {
      await progressService.recordValidation(
        testUser.id,
        testChallenge.id,
        false,
        false
      );

      const attempt = await Attempt.findOne({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      const solve = await Solve.findOne({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      expect(attempt).not.toBeNull();
      expect(attempt!.success).toBe(false);
      expect(solve).toBeNull();
    });

    it("should not create duplicate solve if already solved", async () => {
      // First solve
      await progressService.recordValidation(
        testUser.id,
        testChallenge.id,
        true,
        false
      );

      // Second validation (already solved)
      await progressService.recordValidation(
        testUser.id,
        testChallenge.id,
        true,
        true
      );

      const solves = await Solve.findAll({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      expect(solves).toHaveLength(1);

      const attempts = await Attempt.findAll({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge.id,
        },
      });

      expect(attempts).toHaveLength(2);
    });
  });

  describe("hasSolved", () => {
    it("should return true if user solved challenge", async () => {
      await Solve.create({
        user_id: testUser.id,
        challenge_id: testChallenge.id,
      });

      const result = await progressService.hasSolved(
        testUser.id,
        testChallenge.id
      );

      expect(result).toBe(true);
    });

    it("should return false if user has not solved challenge", async () => {
      const result = await progressService.hasSolved(
        testUser.id,
        testChallenge.id
      );

      expect(result).toBe(false);
    });
  });

  describe("getChallengePoints", () => {
    it("should return challenge points", async () => {
      const points = await progressService.getChallengePoints(testChallenge.id);

      expect(points).toBe(100);
    });

    it("should return 0 for non-existent challenge", async () => {
      const points = await progressService.getChallengePoints(99999);

      expect(points).toBe(0);
    });
  });
});