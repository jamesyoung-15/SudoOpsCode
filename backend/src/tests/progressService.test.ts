import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { QueryTypes } from "sequelize";
import {
  testSequelize,
  initTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
} from "./setup.js";
import { ProgressService } from "../services/progressService.js";

describe("ProgressService", () => {
  let progressService: ProgressService;

  beforeAll(async () => {
    await initTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
    progressService = new ProgressService(testSequelize);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe("recordAttempt", () => {
    it("should record a successful attempt", async () => {
      const [userId] = await testSequelize.query(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        {
          replacements: ["testuser", "hash"],
          type: QueryTypes.INSERT,
        },
      );
      const [challengeId] = await testSequelize.query(
        "INSERT INTO challenges (title, description, difficulty, points, category, directory) VALUES (?, ?, ?, ?, ?, ?)",
        {
          replacements: ["Test", "Desc", "easy", 100, "linux", "test"],
          type: QueryTypes.INSERT,
        },
      );
      await progressService.recordAttempt(1, 1, true);

      const attempts = (await testSequelize.query(
        "SELECT * FROM attempts WHERE user_id = ? AND challenge_id = ?",
        {
          replacements: [1, 1],
          type: QueryTypes.SELECT,
        },
      )) as any[];

      expect(attempts).toHaveLength(1);
      expect(attempts[0].success).toBe(1);
    });
  });

  describe("getChallengePoints", () => {
    it("should return challenge points", async () => {
      await testSequelize.query(
        "INSERT INTO challenges (title, description, difficulty, points, category, directory) VALUES (?, ?, ?, ?, ?, ?)",
        {
          replacements: ["Test", "Desc", "easy", 100, "linux", "test"],
          type: QueryTypes.INSERT,
        },
      );

      const points = await progressService.getChallengePoints(1);

      expect(points).toBe(100);
    });

    it("should return 0 if challenge not found", async () => {
      const points = await progressService.getChallengePoints(999);
      expect(points).toBe(0);
    });
  });
});
