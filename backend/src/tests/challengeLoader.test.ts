import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  jest,
} from "@jest/globals";
import { QueryTypes } from "sequelize";
import {
  testSequelize,
  initTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
} from "./setup.js";

// Create mock functions BEFORE any mocks
const mockAccess = jest.fn<any>();
const mockMkdir = jest.fn<any>();
const mockReaddir = jest.fn<any>();
const mockStat = jest.fn<any>();
const mockReadFile = jest.fn<any>();
const mockChmod = jest.fn<any>();
const mockParse = jest.fn<any>();

// Mock fs/promises module
jest.unstable_mockModule("fs/promises", () => ({
  default: {
    access: mockAccess,
    mkdir: mockMkdir,
    readdir: mockReaddir,
    stat: mockStat,
    readFile: mockReadFile,
    chmod: mockChmod,
    constants: {
      F_OK: 0,
      S_IXUSR: 0o100,
    },
  },
}));

// Mock fs constants (these are still from the regular fs module)
jest.unstable_mockModule("fs", () => ({
  constants: {
    F_OK: 0,
    S_IXUSR: 0o100,
  },
}));

jest.unstable_mockModule("yaml", () => ({
  default: {
    parse: mockParse,
  },
}));

jest.unstable_mockModule("../db/database.js", () => ({
  sequelize: testSequelize,
}));

// Import the service AFTER setting up mocks
const { ChallengeLoader } = await import("../services/challengeLoader.js");

describe("ChallengeLoader", () => {
  let challengeLoader: InstanceType<typeof ChallengeLoader>;

  beforeAll(async () => {
    await initTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
    jest.clearAllMocks();

    // Reset all mock implementations to prevent test pollution
    mockAccess.mockReset();
    mockMkdir.mockReset();
    mockReaddir.mockReset();
    mockStat.mockReset();
    mockReadFile.mockReset();
    mockChmod.mockReset();
    mockParse.mockReset();

    challengeLoader = new ChallengeLoader(
      testSequelize,
      "/fake/test/challenges",
    );
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe("loadChallenges", () => {
    it("should create challenges directory if it does not exist", async () => {
      mockAccess.mockRejectedValueOnce(new Error("ENOENT")); // Directory doesn't exist
      mockMkdir.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([]); // Empty directory after creation

      await challengeLoader.loadChallenges();

      expect(mockMkdir).toHaveBeenCalledWith("/fake/test/challenges", {
        recursive: true,
      });
    });

    it("should load all valid challenge directories", async () => {
      // Mock directory exists
      mockAccess
        .mockResolvedValueOnce(undefined) // challenges dir exists
        // Challenge 1 validation
        .mockResolvedValueOnce(undefined) // challenge.yaml exists
        .mockResolvedValueOnce(undefined) // validate.sh exists
        .mockRejectedValueOnce(new Error("ENOENT")) // setup.sh doesn't exist
        // Challenge 2 validation
        .mockResolvedValueOnce(undefined) // challenge.yaml exists
        .mockResolvedValueOnce(undefined) // validate.sh exists
        .mockRejectedValueOnce(new Error("ENOENT")); // setup.sh doesn't exist

      mockReaddir.mockResolvedValue([
        { name: "challenge1", isDirectory: () => true },
        { name: "challenge2", isDirectory: () => true },
        { name: "file.txt", isDirectory: () => false },
      ]);

      // Mock stat checks for validate.sh (check if executable)
      mockStat
        .mockResolvedValueOnce({ mode: 0o755 }) // challenge1 validate.sh executable
        .mockResolvedValueOnce({ mode: 0o755 }); // challenge2 validate.sh executable

      // Mock YAML reading
      mockReadFile
        .mockResolvedValueOnce("yaml content 1")
        .mockResolvedValueOnce("yaml content 2");

      mockParse
        .mockReturnValueOnce({
          title: "Challenge 1",
          description: "Description 1",
          difficulty: "easy",
          points: 100,
          category: "linux",
          solution: "Solution 1",
        })
        .mockReturnValueOnce({
          title: "Challenge 2",
          description: "Description 2",
          difficulty: "medium",
          points: 200,
          category: "networking",
          solution: "Solution 2",
        });

      await challengeLoader.loadChallenges();

      // Verify challenges were inserted
      const challenges = (await testSequelize.query(
        "SELECT * FROM challenges ORDER BY directory",
        { type: QueryTypes.SELECT },
      )) as any[];

      expect(challenges).toHaveLength(2);
      expect(challenges[0].title).toBe("Challenge 1");
      expect(challenges[0].directory).toBe("challenge1");
      expect(challenges[1].title).toBe("Challenge 2");
      expect(challenges[1].directory).toBe("challenge2");
    });

    it("should update existing challenges", async () => {
      // Insert initial challenge
      await testSequelize.query(
        "INSERT INTO challenges (title, description, difficulty, points, category, directory) VALUES (?, ?, ?, ?, ?, ?)",
        {
          replacements: [
            "Old Title",
            "Old Desc",
            "easy",
            50,
            "linux",
            "challenge1",
          ],
          type: QueryTypes.INSERT,
        },
      );

      mockAccess
        .mockResolvedValueOnce(undefined) // challenges dir exists
        .mockResolvedValueOnce(undefined) // challenge.yaml exists
        .mockResolvedValueOnce(undefined) // validate.sh exists
        .mockRejectedValueOnce(new Error("ENOENT")); // setup.sh doesn't exist

      mockReaddir.mockResolvedValue([
        { name: "challenge1", isDirectory: () => true },
      ]);

      mockStat.mockResolvedValue({ mode: 0o755 });
      mockReadFile.mockResolvedValue("yaml content");
      mockParse.mockReturnValue({
        title: "Updated Title",
        description: "Updated Desc",
        difficulty: "hard",
        points: 150,
        category: "scripting",
        solution: "Updated Solution",
      });

      await challengeLoader.loadChallenges();

      // Verify challenge was updated
      const challenges = (await testSequelize.query(
        "SELECT * FROM challenges WHERE directory = ?",
        {
          replacements: ["challenge1"],
          type: QueryTypes.SELECT,
        },
      )) as any[];

      expect(challenges).toHaveLength(1);
      expect(challenges[0].title).toBe("Updated Title");
      expect(challenges[0].points).toBe(150);
      expect(challenges[0].difficulty).toBe("hard");
    });

    it("should handle loading errors gracefully", async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // challenges dir exists
        .mockRejectedValueOnce(new Error("ENOENT")); // challenge.yaml missing

      mockReaddir.mockResolvedValue([
        { name: "invalid-challenge", isDirectory: () => true },
      ]);

      // Should not throw, but log error
      await expect(challengeLoader.loadChallenges()).resolves.not.toThrow();

      // Verify no challenges were loaded
      const challenges = (await testSequelize.query(
        "SELECT * FROM challenges",
        { type: QueryTypes.SELECT },
      )) as any[];

      expect(challenges).toHaveLength(0);
    });

    it("should make validate.sh executable if not already", async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // challenges dir exists
        .mockResolvedValueOnce(undefined) // challenge.yaml exists
        .mockResolvedValueOnce(undefined) // validate.sh exists
        .mockRejectedValueOnce(new Error("ENOENT")); // setup.sh doesn't exist

      mockReaddir.mockResolvedValue([
        { name: "challenge1", isDirectory: () => true },
      ]);

      // validate.sh not executable
      mockStat.mockResolvedValueOnce({ mode: 0o644 });
      mockChmod.mockResolvedValue(undefined);

      mockReadFile.mockResolvedValue("yaml content");
      mockParse.mockReturnValue({
        title: "Test",
        description: "Desc",
        difficulty: "easy",
        points: 100,
        category: "linux",
      });

      await challengeLoader.loadChallenges();

      // Should have called chmod to make it executable
      expect(mockChmod).toHaveBeenCalledWith(
        expect.stringContaining("validate.sh"),
        "755",
      );
    });
  });

  describe("validateMetadata", () => {
    it("should accept valid metadata", () => {
      const validMetadata = {
        title: "Test Challenge",
        description: "Test description",
        difficulty: "easy" as const,
        points: 100,
        category: "linux",
        solution: "Test solution",
      };

      expect(() => {
        (challengeLoader as any).validateMetadata(validMetadata, "test");
      }).not.toThrow();
    });

    it("should reject metadata without title", () => {
      const invalidMetadata = {
        description: "Test",
        difficulty: "easy" as const,
        points: 100,
        category: "linux",
      } as any;

      expect(() => {
        (challengeLoader as any).validateMetadata(invalidMetadata, "test");
      }).toThrow(/title is required/);
    });

    it("should reject metadata with invalid difficulty", () => {
      const invalidMetadata = {
        title: "Test",
        description: "Test",
        difficulty: "invalid",
        points: 100,
        category: "linux",
      } as any;

      expect(() => {
        (challengeLoader as any).validateMetadata(invalidMetadata, "test");
      }).toThrow(/difficulty must be one of/);
    });

    it("should reject metadata with non-positive points", () => {
      const invalidMetadata = {
        title: "Test",
        description: "Test",
        difficulty: "easy" as const,
        points: 0,
        category: "linux",
      };

      expect(() => {
        (challengeLoader as any).validateMetadata(invalidMetadata, "test");
      }).toThrow(/points is required and must be a positive number/);
    });

    it("should reject metadata with negative points", () => {
      const invalidMetadata = {
        title: "Test",
        description: "Test",
        difficulty: "easy" as const,
        points: -10,
        category: "linux",
      };

      expect(() => {
        (challengeLoader as any).validateMetadata(invalidMetadata, "test");
      }).toThrow(/points is required and must be a positive number/);
    });

    it("should reject metadata without category", () => {
      const invalidMetadata = {
        title: "Test",
        description: "Test",
        difficulty: "easy" as const,
        points: 100,
      } as any;

      expect(() => {
        (challengeLoader as any).validateMetadata(invalidMetadata, "test");
      }).toThrow(/category is required/);
    });

    it("should allow metadata without solution", () => {
      const validMetadata = {
        title: "Test",
        description: "Test",
        difficulty: "medium" as const,
        points: 150,
        category: "networking",
      };

      expect(() => {
        (challengeLoader as any).validateMetadata(validMetadata, "test");
      }).not.toThrow();
    });
  });

  describe("parseChallengeMetadata", () => {
    it("should parse valid YAML", async () => {
      mockReadFile.mockResolvedValue("title: Test\npoints: 100");
      mockParse.mockReturnValue({
        title: "Test",
        points: 100,
      });

      const result = await (challengeLoader as any).parseChallengeMetadata(
        "/fake/path",
        "test",
      );

      expect(result).toEqual({ title: "Test", points: 100 });
    });

    it("should throw error on invalid YAML", async () => {
      mockReadFile.mockResolvedValue("invalid: [yaml");
      mockParse.mockImplementation(() => {
        throw new Error("Invalid YAML");
      });

      await expect(
        (challengeLoader as any).parseChallengeMetadata("/fake/path", "test"),
      ).rejects.toThrow(/Invalid YAML in test\/challenge.yaml/);
    });
  });

  describe("getChallengeDirectory", () => {
    it("should return challenge directory path", async () => {
      // Insert test challenge
      await testSequelize.query(
        "INSERT INTO challenges (title, description, difficulty, points, category, directory) VALUES (?, ?, ?, ?, ?, ?)",
        {
          replacements: [
            "Test",
            "Desc",
            "easy",
            100,
            "linux",
            "test-challenge",
          ],
          type: QueryTypes.INSERT,
        },
      );

      const result = await challengeLoader.getChallengeDirectory(1);

      expect(result).toBe("/fake/test/challenges/test-challenge");
    });

    it("should throw error if challenge not found", async () => {
      await expect(challengeLoader.getChallengeDirectory(999)).rejects.toThrow(
        "Challenge not found: 999",
      );
    });
  });

  describe("validateChallengeDirectory", () => {
    it("should pass validation for complete challenge", async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // challenge.yaml exists
        .mockResolvedValueOnce(undefined) // validate.sh exists
        .mockRejectedValueOnce(new Error("ENOENT")); // setup.sh doesn't exist

      mockStat.mockResolvedValueOnce({ mode: 0o755 }); // validate.sh is executable

      await expect(
        (challengeLoader as any).validateChallengeDirectory(
          "/fake/path",
          "test",
        ),
      ).resolves.not.toThrow();
    });

    it("should throw error if challenge.yaml is missing", async () => {
      mockAccess.mockRejectedValueOnce(new Error("ENOENT")); // challenge.yaml missing

      await expect(
        (challengeLoader as any).validateChallengeDirectory(
          "/fake/path",
          "test",
        ),
      ).rejects.toThrow(/Missing required file: test\/challenge.yaml/);
    });

    it("should throw error if validate.sh is missing", async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // challenge.yaml exists
        .mockRejectedValueOnce(new Error("ENOENT")); // validate.sh missing

      await expect(
        (challengeLoader as any).validateChallengeDirectory(
          "/fake/path",
          "test",
        ),
      ).rejects.toThrow(/Missing required file: test\/validate.sh/);
    });

    it("should fix permissions on non-executable validate.sh", async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // challenge.yaml exists
        .mockResolvedValueOnce(undefined) // validate.sh exists
        .mockRejectedValueOnce(new Error("ENOENT")); // setup.sh doesn't exist

      mockStat.mockResolvedValueOnce({ mode: 0o644 }); // validate.sh not executable
      mockChmod.mockResolvedValue(undefined);

      await (challengeLoader as any).validateChallengeDirectory(
        "/fake/path",
        "test",
      );

      expect(mockChmod).toHaveBeenCalledWith("/fake/path/validate.sh", "755");
    });
  });
});
