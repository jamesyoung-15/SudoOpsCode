import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock Docker
const mockGetImage = jest.fn<any>();
const mockInspect = jest.fn<any>();
const mockBuildImage = jest.fn<any>();
const mockFollowProgress = jest.fn<any>();
const mockCreateContainer = jest.fn<any>();
const mockStart = jest.fn<any>();
const mockExec = jest.fn<any>();
const mockExecStart = jest.fn<any>();
const mockExecInspect = jest.fn<any>();
const mockStop = jest.fn<any>();
const mockRemove = jest.fn<any>();
const mockListContainers = jest.fn<any>();
const mockGetContainer = jest.fn<any>();

jest.unstable_mockModule("dockerode", () => ({
  default: class {
    getImage = mockGetImage;
    buildImage = mockBuildImage;
    createContainer = mockCreateContainer;
    listContainers = mockListContainers;
    getContainer = mockGetContainer;
    modem = {
      followProgress: mockFollowProgress,
    };
  },
}));

// Mock fs
const mockExistsSync = jest.fn<any>();
const mockReadFileSync = jest.fn<any>();

jest.unstable_mockModule("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
}));

// Mock challengeLoader
const mockGetChallengeDirectory = jest.fn<any>();

jest.unstable_mockModule("../services/challengeLoader.js", () => ({
  challengeLoader: {
    getChallengeDirectory: mockGetChallengeDirectory,
  },
}));

// Mock config
jest.unstable_mockModule("../config/index.js", () => ({
  config: {
    docker: {
      imageName: "test-image:latest",
      challengesPath: "/fake/challenges",
      memoryLimit: 256 * 1024 * 1024,
      cpuLimit: 0.5,
    },
  },
}));

// Import after mocks
const { ContainerManager } = await import("../services/containerManager.js");

describe("ContainerManager", () => {
  let containerManager: InstanceType<typeof ContainerManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    containerManager = new ContainerManager();

    // Default mocks
    mockGetImage.mockReturnValue({ inspect: mockInspect });
    mockGetContainer.mockReturnValue({
      start: mockStart,
      exec: mockExec,
      stop: mockStop,
      remove: mockRemove,
    });
  });

  describe("ensureImage", () => {
    it("should skip building if image already exists", async () => {
      mockInspect.mockResolvedValue({});

      await containerManager.ensureImage();

      expect(mockInspect).toHaveBeenCalled();
      expect(mockBuildImage).not.toHaveBeenCalled();
    });

    it("should build image if it doesn't exist", async () => {
      mockInspect.mockRejectedValue(new Error("Image not found"));
      mockBuildImage.mockResolvedValue({});
      mockFollowProgress.mockImplementation((stream, cb) => {
        cb(null, []);
      });

      await containerManager.ensureImage();

      expect(mockBuildImage).toHaveBeenCalled();
      expect(mockFollowProgress).toHaveBeenCalled();
    });

    it("should throw error if build fails", async () => {
      mockInspect.mockRejectedValue(new Error("Image not found"));
      mockBuildImage.mockResolvedValue({});
      mockFollowProgress.mockImplementation((stream, cb) => {
        cb(new Error("Build failed"), null);
      });

      await expect(containerManager.ensureImage()).rejects.toThrow(
        "Build failed",
      );
    });
  });

  describe("createContainer", () => {
    beforeEach(() => {
      mockInspect.mockResolvedValue({});
      mockGetChallengeDirectory.mockResolvedValue(
        "/fake/challenges/test-challenge",
      );
      mockExistsSync.mockReturnValue(true);
      mockCreateContainer.mockResolvedValue({
        id: "container123",
        start: mockStart,
        exec: mockExec,
      });
      mockStart.mockResolvedValue(undefined);
      mockExec.mockResolvedValue({
        start: mockExecStart,
      });
      mockExecStart.mockResolvedValue(undefined);
    });

    it("should create container with correct configuration", async () => {
      const containerId = await containerManager.createContainer(1, 100);

      expect(containerId).toBe("container123");
      expect(mockCreateContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: "test-image:latest",
          Tty: true,
          OpenStdin: true,
          HostConfig: expect.objectContaining({
            Binds: ["/fake/challenges/test-challenge:/challenge:ro"],
            Memory: 256 * 1024 * 1024,
            PidsLimit: 100,
            NetworkMode: "none",
          }),
          Labels: expect.objectContaining({
            "challenges.user_id": "100",
            "challenges.challenge_id": "1",
          }),
        }),
      );
    });

    it("should start container after creation", async () => {
      await containerManager.createContainer(1, 100);

      expect(mockStart).toHaveBeenCalled();
    });

    it("should run setup script if it exists", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // Challenge dir exists
        .mockReturnValueOnce(true); // setup.sh exists

      await containerManager.createContainer(1, 100);

      expect(mockExec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ["/bin/bash", "/challenge/setup.sh"],
        }),
      );
      expect(mockExecStart).toHaveBeenCalled();
    });

    it("should skip setup script if it doesn't exist", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // Challenge dir exists
        .mockReturnValueOnce(false); // setup.sh doesn't exist

      await containerManager.createContainer(1, 100);

      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should throw error if challenge directory doesn't exist", async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(containerManager.createContainer(1, 100)).rejects.toThrow(
        "Challenge directory not found",
      );
    });

    it("should ensure image exists before creating container", async () => {
      await containerManager.createContainer(1, 100);

      expect(mockInspect).toHaveBeenCalled();
    });
  });

  describe("removeContainer", () => {
    it("should stop and remove container", async () => {
      mockStop.mockResolvedValue(undefined);
      mockRemove.mockResolvedValue(undefined);

      await containerManager.removeContainer("container123");

      expect(mockStop).toHaveBeenCalledWith({ t: 5 });
      expect(mockRemove).toHaveBeenCalledWith({ force: true });
    });

    it("should force remove even if stop fails", async () => {
      mockStop.mockRejectedValue(new Error("Already stopped"));
      mockRemove.mockResolvedValue(undefined);

      await containerManager.removeContainer("container123");

      expect(mockRemove).toHaveBeenCalledWith({ force: true });
    });

    it("should throw error if removal fails", async () => {
      mockStop.mockResolvedValue(undefined);
      mockRemove.mockRejectedValue(new Error("Removal failed"));

      await expect(
        containerManager.removeContainer("container123"),
      ).rejects.toThrow("Removal failed");
    });
  });

  describe("validateChallenge", () => {
    beforeEach(() => {
      mockGetChallengeDirectory.mockResolvedValue(
        "/fake/challenges/test-challenge",
      );
      mockExistsSync.mockReturnValue(true);
      mockExec.mockResolvedValue({
        start: mockExecStart,
        inspect: mockExecInspect,
      });
    });

    it("should return true for successful validation", async () => {
      const mockStream = {
        on: jest.fn((event: string, callback: any) => {
          if (event === "end") {
            setTimeout(callback, 10);
          }
          return mockStream;
        }),
      };

      mockExecStart.mockResolvedValue(mockStream);
      mockExecInspect.mockResolvedValue({ ExitCode: 0 });

      const result = await containerManager.validateChallenge(
        "container123",
        1,
      );

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ["/bin/bash", "/challenge/validate.sh"],
        }),
      );
    });

    it("should return false for failed validation", async () => {
      const mockStream = {
        on: jest.fn((event: string, callback: any) => {
          if (event === "end") {
            setTimeout(callback, 10);
          }
          return mockStream;
        }),
      };

      mockExecStart.mockResolvedValue(mockStream);
      mockExecInspect.mockResolvedValue({ ExitCode: 1 });

      const result = await containerManager.validateChallenge(
        "container123",
        1,
      );

      expect(result).toBe(false);
    });

    it("should throw error if validation script doesn't exist", async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(
        containerManager.validateChallenge("container123", 1),
      ).rejects.toThrow("Validation script not found");
    });

    it("should return false if validation execution fails", async () => {
      mockExecStart.mockRejectedValue(new Error("Execution failed"));

      const result = await containerManager.validateChallenge(
        "container123",
        1,
      );

      expect(result).toBe(false);
    });
  });

  describe("createExec", () => {
    it("should create exec instance", async () => {
      const mockExecInstance = {
        id: "exec123",
      };
      mockExec.mockResolvedValue(mockExecInstance);

      const options = { Cmd: ["ls", "-la"] };
      const result = await containerManager.createExec("container123", options);

      expect(result).toEqual(mockExecInstance);
      expect(mockExec).toHaveBeenCalledWith(options);
    });
  });

  describe("cleanupAllContainers", () => {
    it("should cleanup all challenge containers", async () => {
      mockListContainers.mockResolvedValue([
        { Id: "container1" },
        { Id: "container2" },
        { Id: "container3" },
      ]);
      mockStop.mockResolvedValue(undefined);
      mockRemove.mockResolvedValue(undefined);

      await containerManager.cleanupAllContainers();

      expect(mockListContainers).toHaveBeenCalledWith({
        all: true,
        filters: {
          label: ["challenges.user_id"],
        },
      });
      expect(mockStop).toHaveBeenCalledTimes(3);
      expect(mockRemove).toHaveBeenCalledTimes(3);
    });

    it("should handle empty container list", async () => {
      mockListContainers.mockResolvedValue([]);

      await expect(
        containerManager.cleanupAllContainers(),
      ).resolves.not.toThrow();

      expect(mockStop).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("should continue cleanup even if one container fails", async () => {
      mockListContainers.mockResolvedValue([
        { Id: "container1" },
        { Id: "container2" },
      ]);
      mockStop.mockResolvedValue(undefined);
      mockRemove
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Failed to remove"));

      await expect(containerManager.cleanupAllContainers()).rejects.toThrow(
        "Failed to remove",
      );

      expect(mockRemove).toHaveBeenCalledTimes(2);
    });
  });
});
