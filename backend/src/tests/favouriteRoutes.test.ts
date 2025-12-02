import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Response } from "express";
import { QueryTypes } from "sequelize";

// Mock sequelize
const mockQuery = jest.fn<any>();

jest.unstable_mockModule("../db/database.js", () => ({
  sequelize: {
    query: mockQuery,
  },
}));

// Mock authenticateToken middleware
const mockAuthenticateToken = jest.fn<any>();

jest.unstable_mockModule("../middleware/auth.js", () => ({
  authenticateToken: mockAuthenticateToken,
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

jest.unstable_mockModule("../utils/logger.js", () => ({
  logger: mockLogger,
}));

// Import router after mocks
const favoritesModule = await import("../routes/favorites.js");
const router = favoritesModule.default;

describe("Favorites Routes", () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: { userId: 1 },
      query: {},
      params: {},
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Setup authenticateToken to call the next handler
    mockAuthenticateToken.mockImplementation(
      (req: any, res: any, next: any) => {
        next();
      },
    );
  });

  describe("GET /api/favorites", () => {
    it("should return paginated favorites with default pagination", async () => {
      const mockCountResult = [{ total: 5 }];
      const mockFavorites = [
        {
          id: 1,
          title: "Challenge 1",
          difficulty: "easy",
          points: 100,
          category: "linux",
          favorited_at: "2024-01-01",
          solved: 1,
        },
        {
          id: 2,
          title: "Challenge 2",
          difficulty: "medium",
          points: 200,
          category: "networking",
          favorited_at: "2024-01-02",
          solved: 0,
        },
      ];

      mockQuery
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockFavorites);

      // Get the route handler
      const route = router.stack.find(
        (layer: any) => layer.route?.path === "/" && layer.route?.methods.get,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("COUNT(*)"),
        { replacements: [1], type: QueryTypes.SELECT },
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        favorites: mockFavorites,
        pagination: {
          page: 1,
          limit: 20,
          totalFavorites: 5,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it("should return paginated favorites with custom pagination", async () => {
      mockReq.query = { page: "2", limit: "10" };

      const mockCountResult = [{ total: 25 }];
      const mockFavorites = [{ id: 3, title: "Challenge 3" }];

      mockQuery
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockFavorites);

      const route = router.stack.find(
        (layer: any) => layer.route?.path === "/" && layer.route?.methods.get,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("LIMIT ? OFFSET ?"),
        { replacements: [1, 1, 10, 10], type: QueryTypes.SELECT },
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        favorites: mockFavorites,
        pagination: {
          page: 2,
          limit: 10,
          totalFavorites: 25,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      });
    });

    it("should return 400 for limit exceeding maximum", async () => {
      mockReq.query = { limit: "101" };

      const route = router.stack.find(
        (layer: any) => layer.route?.path === "/" && layer.route?.methods.get,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: expect.stringContaining("Invalid pagination parameters"),
      });
    });

    it("should return 500 on database error", async () => {
      mockQuery.mockRejectedValue(new Error("Database error"));

      const route = router.stack.find(
        (layer: any) => layer.route?.path === "/" && layer.route?.methods.get,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Failed to fetch favorites",
      });
    });
  });

  describe("POST /api/favorites/:challengeId", () => {
    it("should add challenge to favorites", async () => {
      mockReq.params = { challengeId: "1" };

      mockQuery
        .mockResolvedValueOnce([{ id: 1 }]) // Challenge exists
        .mockResolvedValueOnce(undefined); // Insert success

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/:challengeId" && layer.route?.methods.post,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        "INSERT OR IGNORE INTO favorites (user_id, challenge_id) VALUES (?, ?)",
        { replacements: [1, 1], type: QueryTypes.INSERT },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 1, challengeId: 1 },
        "Added to favorites",
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Added to favorites",
      });
    });

    it("should return 400 for invalid challenge ID", async () => {
      mockReq.params = { challengeId: "invalid" };

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/:challengeId" && layer.route?.methods.post,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid challenge ID",
      });
    });

    it("should return 404 if challenge not found", async () => {
      mockReq.params = { challengeId: "999" };
      mockQuery.mockResolvedValueOnce([]); // Challenge not found

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/:challengeId" && layer.route?.methods.post,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Challenge not found",
      });
    });

    it("should return 500 on database error", async () => {
      mockReq.params = { challengeId: "1" };
      mockQuery.mockRejectedValue(new Error("Database error"));

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/:challengeId" && layer.route?.methods.post,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Failed to add favorite",
      });
    });
  });

  describe("DELETE /api/favorites/:challengeId", () => {
    it("should remove challenge from favorites", async () => {
      mockReq.params = { challengeId: "1" };
      mockQuery.mockResolvedValueOnce(undefined);

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/:challengeId" && layer.route?.methods.delete,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockQuery).toHaveBeenCalledWith(
        "DELETE FROM favorites WHERE user_id = ? AND challenge_id = ?",
        { replacements: [1, 1], type: QueryTypes.DELETE },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        { userId: 1, challengeId: 1 },
        "Removed from favorites",
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Removed from favorites",
      });
    });

    it("should return 400 for invalid challenge ID", async () => {
      mockReq.params = { challengeId: "invalid" };

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/:challengeId" && layer.route?.methods.delete,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid challenge ID",
      });
    });

    it("should return 500 on database error", async () => {
      mockReq.params = { challengeId: "1" };
      mockQuery.mockRejectedValue(new Error("Database error"));

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/:challengeId" && layer.route?.methods.delete,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Failed to remove favorite",
      });
    });
  });

  describe("GET /api/favorites/check/:challengeId", () => {
    it("should return true if challenge is favorited", async () => {
      mockReq.params = { challengeId: "1" };
      mockQuery.mockResolvedValueOnce([{ id: 1 }]);

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/check/:challengeId" &&
          layer.route?.methods.get,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT id FROM favorites WHERE user_id = ? AND challenge_id = ?",
        { replacements: [1, 1], type: QueryTypes.SELECT },
      );
      expect(mockRes.json).toHaveBeenCalledWith({ isFavorite: true });
    });

    it("should return false if challenge is not favorited", async () => {
      mockReq.params = { challengeId: "1" };
      mockQuery.mockResolvedValueOnce([]);

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/check/:challengeId" &&
          layer.route?.methods.get,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ isFavorite: false });
    });

    it("should return 400 for invalid challenge ID", async () => {
      mockReq.params = { challengeId: "invalid" };

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/check/:challengeId" &&
          layer.route?.methods.get,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid challenge ID",
      });
    });

    it("should return 500 on database error", async () => {
      mockReq.params = { challengeId: "1" };
      mockQuery.mockRejectedValue(new Error("Database error"));

      const route = router.stack.find(
        (layer: any) =>
          layer.route?.path === "/check/:challengeId" &&
          layer.route?.methods.get,
      );
      const handler = route.route.stack[route.route.stack.length - 1].handle;

      await handler(mockReq, mockRes, mockNext);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Failed to check favorite status",
      });
    });
  });
});
