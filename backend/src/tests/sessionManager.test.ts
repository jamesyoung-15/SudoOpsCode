import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Server } from "http";

// Mock container manager
const mockRemoveContainer = jest.fn<any>();

jest.unstable_mockModule("../services/containerManager.js", () => ({
  containerManager: {
    removeContainer: mockRemoveContainer,
  },
}));

// Mock WebSocket service
const mockCloseConnection = jest.fn<any>();

jest.unstable_mockModule("../services/websocketService.js", () => ({
  WebSocketService: class {
    closeConnection = mockCloseConnection;
  },
}));

// mock server
const mockServer = {
  on: jest.fn(),
  listen: jest.fn(),
} as unknown as Server;

// Import after mocks
const { SessionManager } = await import("../services/sessionManager.js");
const { WebSocketService } = await import("../services/websocketService.js");

describe("SessionManager", () => {
  let sessionManager: InstanceType<typeof SessionManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionManager = new SessionManager(900000, 3600000); // 15 min idle, 60 min max
  });

  describe("canCreateSession", () => {
    it("should allow session creation when under limits", () => {
      const result = sessionManager.canCreateSession(1);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should deny session creation when user has max sessions", () => {
      // Create max sessions for user
      sessionManager.createSession(1, 1, "container1");

      const result = sessionManager.canCreateSession(1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Maximum");
      expect(result.reason).toContain("per user");
    });

    it("should deny session creation when system at capacity", () => {
      // Create 15 sessions for different users
      for (let i = 1; i <= 15; i++) {
        sessionManager.createSession(i, 1, `container${i}`);
      }

      const result = sessionManager.canCreateSession(999);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("System at capacity");
    });
  });

  describe("createSession", () => {
    it("should create a valid session", () => {
      const session = sessionManager.createSession(1, 2, "container123");

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.userId).toBe(1);
      expect(session.challengeId).toBe(2);
      expect(session.containerId).toBe("container123");
      expect(session.status).toBe("active");
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActivity).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it("should create sessions with unique IDs", () => {
      const session1 = sessionManager.createSession(1, 1, "container1");
      const session2 = sessionManager.createSession(2, 1, "container2");

      expect(session1.id).not.toBe(session2.id);
    });

    it("should set expiry time correctly", () => {
      const before = Date.now();
      const session = sessionManager.createSession(1, 1, "container1");
      const after = Date.now();

      const expiryTime = session.expiresAt.getTime();
      const expectedMin = before + 3600000; // 60 minutes
      const expectedMax = after + 3600000;

      expect(expiryTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expiryTime).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe("getSession", () => {
    it("should retrieve existing session", () => {
      const created = sessionManager.createSession(1, 1, "container1");
      const retrieved = sessionManager.getSession(created.id);

      expect(retrieved).toEqual(created);
    });

    it("should return undefined for non-existent session", () => {
      const result = sessionManager.getSession("non-existent-id");

      expect(result).toBeUndefined();
    });
  });

  describe("updateActivity", () => {
    it("should update last activity timestamp", async () => {
      const session = sessionManager.createSession(1, 1, "container1");
      const originalActivity = session.lastActivity;

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      sessionManager.updateActivity(session.id);

      const updated = sessionManager.getSession(session.id);
      expect(updated?.lastActivity.getTime()).toBeGreaterThan(
        originalActivity.getTime(),
      );
    });

    it("should do nothing for non-existent session", () => {
      expect(() => {
        sessionManager.updateActivity("non-existent-id");
      }).not.toThrow();
    });
  });

  describe("endSession", () => {
    it("should end an active session", () => {
      const session = sessionManager.createSession(1, 1, "container1");

      sessionManager.endSession(session.id);

      const retrieved = sessionManager.getSession(session.id);
      expect(retrieved).toBeUndefined();
    });

    it("should close WebSocket connection when WebSocket service is set", (done) => {
      const wsService = new WebSocketService(mockServer);
      sessionManager.setWebSocketService(wsService);

      const session = sessionManager.createSession(1, 1, "container1");

      sessionManager.endSession(session.id);

      // WebSocket closes asynchronously
      setTimeout(() => {
        expect(mockCloseConnection).toHaveBeenCalledWith(session.id);
        done();
      }, 50);
    });

    it("should not throw if WebSocket connection fails to close", (done) => {
      const wsService = new WebSocketService(mockServer);
      sessionManager.setWebSocketService(wsService);
      mockCloseConnection.mockImplementation(() => {
        throw new Error("WebSocket error");
      });

      const session = sessionManager.createSession(1, 1, "container1");

      expect(() => {
        sessionManager.endSession(session.id);
      }).not.toThrow();

      setTimeout(() => {
        done();
      }, 50);
    });

    it("should do nothing for non-existent session", () => {
      expect(() => {
        sessionManager.endSession("non-existent-id");
      }).not.toThrow();
    });
  });

  describe("getActiveSessions", () => {
    it("should return only active sessions", () => {
      sessionManager.createSession(1, 1, "container1");
      sessionManager.createSession(2, 1, "container2");
      const session3 = sessionManager.createSession(3, 1, "container3");

      sessionManager.endSession(session3.id);

      const active = sessionManager.getActiveSessions();

      expect(active).toHaveLength(2);
      expect(active.every((s) => s.status === "active")).toBe(true);
    });

    it("should return empty array when no sessions exist", () => {
      const active = sessionManager.getActiveSessions();

      expect(active).toEqual([]);
    });
  });

  describe("getUserSessions", () => {
    it("should return sessions for specific user", () => {
      sessionManager.createSession(1, 1, "container1");
      sessionManager.createSession(2, 1, "container2");

      const user1Sessions = sessionManager.getUserSessions(1);
      const user2Sessions = sessionManager.getUserSessions(2);

      expect(user1Sessions).toHaveLength(1); // Only 1 allowed per user
      expect(user2Sessions).toHaveLength(1);
    });

    it("should return empty array for user with no sessions", () => {
      const sessions = sessionManager.getUserSessions(999);

      expect(sessions).toEqual([]);
    });
  });

  describe("getExpiredSessions", () => {
    it("should identify idle expired sessions", async () => {
      // Create session manager with 50ms idle timeout
      const shortSessionManager = new SessionManager(50, 3600000);
      shortSessionManager.createSession(1, 1, "container1");

      // Wait for idle timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      const expired = shortSessionManager.getExpiredSessions();

      expect(expired).toHaveLength(1);
    });

    it("should identify max time expired sessions", async () => {
      // Create session manager with 50ms max time
      const shortSessionManager = new SessionManager(900000, 50);
      const session = shortSessionManager.createSession(1, 1, "container1");

      // Keep updating activity to avoid idle timeout
      const interval = setInterval(() => {
        shortSessionManager.updateActivity(session.id);
      }, 10);

      // Wait for max timeout
      await new Promise((resolve) => setTimeout(resolve, 100));
      clearInterval(interval);

      const expired = shortSessionManager.getExpiredSessions();

      expect(expired).toHaveLength(1);
    });

    it("should return empty array when no sessions are expired", () => {
      sessionManager.createSession(1, 1, "container1");

      const expired = sessionManager.getExpiredSessions();

      expect(expired).toEqual([]);
    });
  });

  describe("markExpired", () => {
    it("should mark session as expired and remove it", () => {
      const session = sessionManager.createSession(1, 1, "container1");

      sessionManager.markExpired(session.id);

      const retrieved = sessionManager.getSession(session.id);
      expect(retrieved).toBeUndefined();
    });

    it("should do nothing for non-existent session", () => {
      expect(() => {
        sessionManager.markExpired("non-existent-id");
      }).not.toThrow();
    });
  });

  describe("pending session tracking", () => {
    it("should track pending sessions", () => {
      expect(sessionManager.isSessionPending(1, 1)).toBe(false);

      sessionManager.markSessionPending(1, 1);

      expect(sessionManager.isSessionPending(1, 1)).toBe(true);
    });

    it("should clear pending flag", () => {
      sessionManager.markSessionPending(1, 1);

      sessionManager.clearSessionPending(1, 1);

      expect(sessionManager.isSessionPending(1, 1)).toBe(false);
    });

    it("should track different user-challenge combinations separately", () => {
      sessionManager.markSessionPending(1, 1);
      sessionManager.markSessionPending(1, 2);
      sessionManager.markSessionPending(2, 1);

      expect(sessionManager.isSessionPending(1, 1)).toBe(true);
      expect(sessionManager.isSessionPending(1, 2)).toBe(true);
      expect(sessionManager.isSessionPending(2, 1)).toBe(true);
      expect(sessionManager.isSessionPending(2, 2)).toBe(false);
    });
  });

  describe("cleanupStaleSessions", () => {
    it("should cleanup expired sessions and remove containers", async () => {
      const shortSessionManager = new SessionManager(50, 3600000);
      const session = shortSessionManager.createSession(1, 1, "container1");

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 100));

      await shortSessionManager.cleanupStaleSessions();

      expect(mockRemoveContainer).toHaveBeenCalledWith("container1");

      const retrieved = shortSessionManager.getSession(session.id);
      expect(retrieved).toBeUndefined();
    });

    it("should do nothing when no sessions are expired", async () => {
      sessionManager.createSession(1, 1, "container1");

      await sessionManager.cleanupStaleSessions();

      expect(mockRemoveContainer).not.toHaveBeenCalled();
    });

    it("should continue cleanup even if container removal fails", async () => {
      mockRemoveContainer.mockRejectedValueOnce(
        new Error("Container removal failed"),
      );

      const shortSessionManager = new SessionManager(50, 3600000);
      const session = shortSessionManager.createSession(1, 1, "container1");

      await new Promise((resolve) => setTimeout(resolve, 100));

      await shortSessionManager.cleanupStaleSessions();

      // Should still mark session as expired
      const retrieved = shortSessionManager.getSession(session.id);
      expect(retrieved).toBeUndefined();
    });

    it("should cleanup multiple expired sessions", async () => {
      const shortSessionManager = new SessionManager(50, 3600000);
      shortSessionManager.createSession(1, 1, "container1");
      shortSessionManager.createSession(2, 1, "container2");
      shortSessionManager.createSession(3, 1, "container3");

      await new Promise((resolve) => setTimeout(resolve, 100));

      await shortSessionManager.cleanupStaleSessions();

      expect(mockRemoveContainer).toHaveBeenCalledTimes(3);
    });
  });
});
