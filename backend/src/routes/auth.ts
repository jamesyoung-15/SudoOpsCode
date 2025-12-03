import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { RegisterRequest, LoginRequest, AuthResponse } from "../types/auth.js";
import { User } from "../models/index.js";

const router = Router();

// Register
router.post(
  "/register",
  async (req: Request<{}, {}, RegisterRequest>, res: Response) => {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        res.status(400).json({ error: "Username and password are required" });
        return;
      }

      if (username.length < 3 || username.length > 20) {
        res
          .status(400)
          .json({ error: "Username must be between 3 and 20 characters" });
        return;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        res.status(400).json({
          error:
            "Username can only contain letters, numbers, hyphens, and underscores",
        });
        return;
      }

      if (password.length < 8) {
        res
          .status(400)
          .json({ error: "Password must be at least 8 characters" });
        return;
      }

      // Check if user exists
      const existingUser = await User.findOne({
        where: { username },
      });

      if (existingUser) {
        res.status(409).json({ error: "Username already taken" });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

      // Create user
      const user = await User.create({
        username,
        password: passwordHash,
      });

      // Generate token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn },
      );

      logger.info({ userId: user.id, username }, "User registered");

      const response: AuthResponse = {
        token,
        user: {
          userId: user.id,
          username: user.username,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error({ error }, "Registration error");
      res.status(500).json({ error: "Registration failed" });
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
        res.status(400).json({ error: "Username and password are required" });
        return;
      }

      // Find user
      const user = await User.findOne({
        where: { username },
      });

      if (!user) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password);

      if (!passwordValid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn },
      );

      logger.info(
        { userId: user.id, username: user.username },
        "User logged in",
      );

      const response: AuthResponse = {
        token,
        user: {
          userId: user.id,
          username: user.username,
        },
      };

      res.json(response);
    } catch (error) {
      logger.error({ error }, "Login error");
      res.status(500).json({ error: "Login failed" });
    }
  },
);

export default router;
