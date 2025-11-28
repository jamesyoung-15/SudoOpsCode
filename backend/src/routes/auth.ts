import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db/database.js";
import {
  User,
  RegisterRequest,
  LoginRequest,
  JWTPayload,
} from "../types/index.js";
import { logger } from "../utils/logger.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const SALT_ROUNDS = 10;

// Register
router.post(
  "/register",
  async (req: Request<{}, {}, RegisterRequest>, res: Response) => {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        logger.warn("Registration failed: Missing username or password");
        res.status(400).json({ error: "Username and password are required" });
        return;
      }

      if (username.length < 3 || username.length > 20) {
        res
          .status(400)
          .json({ error: "Username must be between 3 and 20 characters" });
        return;
      }

      if (password.length < 6) {
        res
          .status(400)
          .json({ error: "Password must be at least 6 characters" });
        return;
      }

      // Check if user exists
      const existingUser = db
        .prepare("SELECT id FROM users WHERE username = ?")
        .get(username);

      if (existingUser) {
        logger.warn(
          { username },
          "Registration failed: Username already exists",
        );
        res.status(409).json({ error: "Username already exists" });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Insert user
      const result = db
        .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
        .run(username, passwordHash);

      logger.info(
        { userId: result.lastInsertRowid, username },
        "User registered successfully",
      );

      res.status(201).json({
        message: "User registered successfully",
        userId: result.lastInsertRowid,
      });
    } catch (error) {
      logger.error({ error }, "Registration error");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Login
router.post(
  "/login",
  async (req: Request<{}, {}, LoginRequest>, res: Response) => {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        logger.warn("Login failed: Missing username or password");
        res.status(400).json({ error: "Username and password are required" });
        return;
      }

      // Get user
      const user = db
        .prepare(
          "SELECT id, username, password_hash FROM users WHERE username = ?",
        )
        .get(username) as User | undefined;

      if (!user) {
        logger.warn({ username }, "Login failed: User not found");
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash,
      );

      if (!isValidPassword) {
        logger.warn(
          { userId: user.id, username },
          "Login failed: Invalid password",
        );
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      // Generate JWT
      const payload: JWTPayload = {
        userId: user.id,
        username: user.username,
      };

      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      logger.info({ userId: user.id, username }, "User logged in successfully");

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      });
    } catch (error) {
      logger.error({ error }, "Login error");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
