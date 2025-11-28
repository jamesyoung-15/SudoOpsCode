import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../types/index.js";
import { logger } from "../utils/logger.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error("JWT_SECRET is not defined in environment variables");
  throw new Error("JWT_SECRET is required for authentication middleware");
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    logger.warn("Authentication failed: No token provided");
    res.status(401).json({ error: "Access token required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = decoded;
    logger.debug({ userId: decoded.userId }, "User authenticated");
    next();
  } catch (err) {
    logger.warn({ error: err }, "Authentication failed: Invalid token");
    res.status(403).json({ error: "Invalid or expired token" });
  }
}
