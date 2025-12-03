import request from "supertest";
import express from "express";
import authRoutes from "../routes/auth.js";
import { initTestDatabase, cleanTestDatabase, closeTestDatabase } from "./setup.js";

// Create a test app instead of using the main app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  return app;
};

describe("Auth Routes", () => {
  let testApp: express.Application;

  beforeAll(async () => {
    await initTestDatabase();
    testApp = createTestApp();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const response = await request(testApp)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          password: "testpass123",
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("token");
      expect(response.body.user).toHaveProperty("userId");
      expect(response.body.user.username).toBe("testuser");
    });

    it("should reject duplicate username", async () => {
      // First registration
      await request(testApp)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          password: "testpass123",
        });

      // Second registration with same username
      const response = await request(testApp)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          password: "testpass456",
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Username already taken");
    });

    it("should reject short username", async () => {
      const response = await request(testApp)
        .post("/api/auth/register")
        .send({
          username: "ab",
          password: "testpass123",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("between 3 and 20 characters");
    });

    it("should reject short password", async () => {
      const response = await request(testApp)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          password: "short",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("at least 8 characters");
    });

    it("should reject invalid username characters", async () => {
      const response = await request(testApp)
        .post("/api/auth/register")
        .send({
          username: "test@user",
          password: "testpass123",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("letters, numbers, hyphens");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Register a user for login tests
      await request(testApp)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          password: "testpass123",
        });
    });

    it("should login existing user", async () => {
      const response = await request(testApp)
        .post("/api/auth/login")
        .send({
          username: "testuser",
          password: "testpass123",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body.user.username).toBe("testuser");
    });

    it("should reject invalid password", async () => {
      const response = await request(testApp)
        .post("/api/auth/login")
        .send({
          username: "testuser",
          password: "wrongpass",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should reject non-existent user", async () => {
      const response = await request(testApp)
        .post("/api/auth/login")
        .send({
          username: "nonexistent",
          password: "testpass123",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should reject missing credentials", async () => {
      const response = await request(testApp)
        .post("/api/auth/login")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });
  });
});