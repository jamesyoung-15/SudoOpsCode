import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { User } from "../models/User.js";
import { Challenge } from "../models/Challenge.js";
import { Favorite } from "../models/Favorite.js";
import { Solve } from "../models/Solve.js";
import favoriteRoutes from "../routes/favorites.js";
import {
  initTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
} from "./setup.js";

// Create a test app instead of using the main app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/favorites", favoriteRoutes);
  return app;
};

describe("Favorite Routes", () => {
  let testApp: express.Application;
  let testUser: User;
  let testToken: string;
  let testChallenge1: Challenge;
  let testChallenge2: Challenge;

  beforeAll(async () => {
    await initTestDatabase();
    testApp = createTestApp();
  });

  beforeEach(async () => {
    await cleanTestDatabase();

    // Create test user
    testUser = await User.create({
      username: "testuser",
      password: "hashedpassword",
    });

    // Generate token
    testToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      config.jwtSecret,
      { expiresIn: "1h" }
    );

    // Create test challenges
    testChallenge1 = await Challenge.create({
      title: "Challenge 1",
      description: "First test challenge",
      difficulty: "easy",
      points: 100,
      category: "test",
      directory: "challenge-1",
    });

    testChallenge2 = await Challenge.create({
      title: "Challenge 2",
      description: "Second test challenge",
      difficulty: "medium",
      points: 200,
      category: "test",
      directory: "challenge-2",
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe("POST /api/favorites/:challengeId", () => {
    it("should add challenge to favorites", async () => {
      const response = await request(testApp)
        .post(`/api/favorites/${testChallenge1.id}`)
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Added to favorites");

      const favorite = await Favorite.findOne({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge1.id,
        },
      });

      expect(favorite).not.toBeNull();
    });

    it("should handle duplicate favorites gracefully", async () => {
      // Add favorite first time
      await request(testApp)
        .post(`/api/favorites/${testChallenge1.id}`)
        .set("Authorization", `Bearer ${testToken}`);

      // Add favorite second time
      const response = await request(testApp)
        .post(`/api/favorites/${testChallenge1.id}`)
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(200);

      const favorites = await Favorite.findAll({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge1.id,
        },
      });

      expect(favorites).toHaveLength(1);
    });

    it("should return 404 for non-existent challenge", async () => {
      const response = await request(testApp)
        .post(`/api/favorites/99999`)
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Challenge not found");
    });

    it("should return 401 without auth token", async () => {
      const response = await request(testApp).post(
        `/api/favorites/${testChallenge1.id}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/favorites", () => {
    beforeEach(async () => {
      // Add some favorites
      await Favorite.create({
        user_id: testUser.id,
        challenge_id: testChallenge1.id,
      });

      await Favorite.create({
        user_id: testUser.id,
        challenge_id: testChallenge2.id,
      });

      // Mark one as solved
      await Solve.create({
        user_id: testUser.id,
        challenge_id: testChallenge1.id,
      });
    });

    it("should get user favorites with solved status", async () => {
      const response = await request(testApp)
        .get("/api/favorites")
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.favorites).toHaveLength(2);

      const favorite1 = response.body.favorites.find(
        (f: any) => f.id === testChallenge1.id
      );
      const favorite2 = response.body.favorites.find(
        (f: any) => f.id === testChallenge2.id
      );

      expect(favorite1.solved).toBe(1);
      expect(favorite2.solved).toBe(0);
    });

    it("should support pagination", async () => {
      const response = await request(testApp)
        .get("/api/favorites?page=1&limit=1")
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.favorites).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 1,
        totalFavorites: 2,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it("should return empty array for user with no favorites", async () => {
      await Favorite.destroy({ where: { user_id: testUser.id } });

      const response = await request(testApp)
        .get("/api/favorites")
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.favorites).toHaveLength(0);
    });
  });

  describe("DELETE /api/favorites/:challengeId", () => {
    beforeEach(async () => {
      await Favorite.create({
        user_id: testUser.id,
        challenge_id: testChallenge1.id,
      });
    });

    it("should remove challenge from favorites", async () => {
      const response = await request(testApp)
        .delete(`/api/favorites/${testChallenge1.id}`)
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Removed from favorites");

      const favorite = await Favorite.findOne({
        where: {
          user_id: testUser.id,
          challenge_id: testChallenge1.id,
        },
      });

      expect(favorite).toBeNull();
    });

    it("should handle removing non-favorited challenge", async () => {
      const response = await request(testApp)
        .delete(`/api/favorites/${testChallenge2.id}`)
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/favorites/check/:challengeId", () => {
    beforeEach(async () => {
      await Favorite.create({
        user_id: testUser.id,
        challenge_id: testChallenge1.id,
      });
    });

    it("should return true for favorited challenge", async () => {
      const response = await request(testApp)
        .get(`/api/favorites/check/${testChallenge1.id}`)
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isFavorite).toBe(true);
    });

    it("should return false for non-favorited challenge", async () => {
      const response = await request(testApp)
        .get(`/api/favorites/check/${testChallenge2.id}`)
        .set("Authorization", `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isFavorite).toBe(false);
    });
  });
});