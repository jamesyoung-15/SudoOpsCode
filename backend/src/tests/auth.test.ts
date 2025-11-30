import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import express, { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../types/auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

// Create a test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  const router = Router();

  // Protected route for testing authentication middleware
  router.get("/protected", authenticateToken, (req: any, res) => {
    res.json({ message: "Access granted", user: req.user });
  });

  app.use("/api", router);
  return app;
};

describe("Auth Middleware", () => {
  it("should allow access with valid token", async () => {
    const app = createTestApp();

    // create dummy user with signed JWT
    const payload: JWTPayload = { userId: 1, username: "testuser" };
    const token = jwt.sign(payload, JWT_SECRET);

    const response = await request(app)
      .get("/api/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message", "Access granted");
    expect(response.body.user).toHaveProperty("userId", 1);
    expect(response.body.user).toHaveProperty("username", "testuser");
  });

  it("should deny access without token", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api/protected");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("error", "Access token required");
  });

  it("should deny access with invalid token", async () => {
    const app = createTestApp();

    const response = await request(app)
      .get("/api/protected")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("error", "Invalid or expired token");
  });

  it("should deny access with expired token", async () => {
    const app = createTestApp();
    const payload: JWTPayload = { userId: 1, username: "testuser" };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "0s" });

    // Wait a bit to ensure expiration
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await request(app)
      .get("/api/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("error", "Invalid or expired token");
  });
});
