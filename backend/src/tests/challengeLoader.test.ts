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
const mockExistsSync = jest.fn<any>();
const mockMkdirSync = jest.fn<any>();
const mockReaddirSync = jest.fn<any>();
const mockStatSync = jest.fn<any>();
const mockReadFileSync = jest.fn<any>();
const mockChmodSync = jest.fn<any>();
const mockParse = jest.fn<any>();

// Mock modules BEFORE importing the service
jest.unstable_mockModule("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
    readFileSync: mockReadFileSync,
    chmodSync: mockChmodSync,
    constants: {
      S_IXUSR: 0o100,
    },
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
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockReturnValue(undefined);

      await challengeLoader.loadChallenges();

      expect(mockMkdirSync).toHaveBeenCalledWith("/fake/test/challenges", {
        recursive: true,
      });
    });

    it("should load all valid challenge directories", async () => {
      // Mock directory exists
      mockExistsSync
        .mockReturnValueOnce(true) // challenges dir exists
        // Challenge 1 validation
        .mockReturnValueOnce(true) // challenge.yaml exists
        .mockReturnValueOnce(true) // validate.sh exists
        .mockReturnValueOnce(false) // setup.sh doesn't exist
        // Challenge 2 validation
        .mockReturnValueOnce(true) // challenge.yaml exists
        .mockReturnValueOnce(true) // validate.sh exists
        .mockReturnValueOnce(false); // setup.sh doesn't exist

      mockReaddirSync.mockReturnValue([
        { name: "challenge1", isDirectory: () => true },
        { name: "challenge2", isDirectory: () => true },
        { name: "file.txt", isDirectory: () => false },
      ]);

      // Mock stat checks for validate.sh (check if executable)
      mockStatSync
        .mockReturnValueOnce({ mode: 0o755 }) // challenge1 validate.sh executable
        .mockReturnValueOnce({ mode: 0o755 }); // challenge2 validate.sh executable

      // Mock YAML reading
      mockReadFileSync
        .mockReturnValueOnce("yaml content 1")
        .mockReturnValueOnce("yaml content 2");

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

      mockExistsSync
        .mockReturnValueOnce(true) // challenges dir exists
        .mockReturnValueOnce(true) // challenge.yaml exists
        .mockReturnValueOnce(true) // validate.sh exists
        .mockReturnValueOnce(false); // setup.sh doesn't exist

      mockReaddirSync.mockReturnValue([
        { name: "challenge1", isDirectory: () => true },
      ]);

      mockStatSync.mockReturnValue({ mode: 0o755 });
      mockReadFileSync.mockReturnValue("yaml content");
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
      mockExistsSync
        .mockReturnValueOnce(true) // challenges dir exists
        .mockReturnValueOnce(false); // challenge.yaml missing

      mockReaddirSync.mockReturnValue([
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
      mockExistsSync
        .mockReturnValueOnce(true) // challenges dir exists
        .mockReturnValueOnce(true) // challenge.yaml exists
        .mockReturnValueOnce(true) // validate.sh exists
        .mockReturnValueOnce(false); // setup.sh doesn't exist

      mockReaddirSync.mockReturnValue([
        { name: "challenge1", isDirectory: () => true },
      ]);

      // validate.sh not executable
      mockStatSync.mockReturnValueOnce({ mode: 0o644 });

      mockReadFileSync.mockReturnValue("yaml content");
      mockParse.mockReturnValue({
        title: "Test",
        description: "Desc",
        difficulty: "easy",
        points: 100,
        category: "linux",
      });

      await challengeLoader.loadChallenges();

      // Should have called chmod to make it executable
      expect(mockChmodSync).toHaveBeenCalledWith(
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
    it("should parse valid YAML", () => {
      mockReadFileSync.mockReturnValue("title: Test\npoints: 100");
      mockParse.mockReturnValue({
        title: "Test",
        points: 100,
      });

      const result = (challengeLoader as any).parseChallengeMetadata(
        "/fake/path",
        "test",
      );

      expect(result).toEqual({ title: "Test", points: 100 });
    });

    it("should throw error on invalid YAML", () => {
      mockReadFileSync.mockReturnValue("invalid: [yaml");
      mockParse.mockImplementation(() => {
        throw new Error("Invalid YAML");
      });

      expect(() => {
        (challengeLoader as any).parseChallengeMetadata("/fake/path", "test");
      }).toThrow(/Invalid YAML in test\/challenge.yaml/);
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
    it("should pass validation for complete challenge", () => {
      mockExistsSync
        .mockReturnValueOnce(true) // challenge.yaml exists
        .mockReturnValueOnce(true) // validate.sh exists
        .mockReturnValueOnce(false); // setup.sh doesn't exist

      mockStatSync.mockReturnValueOnce({ mode: 0o755 }); // validate.sh is executable

      expect(() => {
        (challengeLoader as any).validateChallengeDirectory(
          "/fake/path",
          "test",
        );
      }).not.toThrow();
    });

    it("should throw error if challenge.yaml is missing", () => {
      mockExistsSync.mockReturnValueOnce(false); // challenge.yaml missing

      expect(() => {
        (challengeLoader as any).validateChallengeDirectory(
          "/fake/path",
          "test",
        );
      }).toThrow(/Missing required file: challenge.yaml/);
    });

    it("should throw error if validate.sh is missing", () => {
      mockExistsSync
        .mockReturnValueOnce(true) // challenge.yaml exists
        .mockReturnValueOnce(false); // validate.sh missing

      expect(() => {
        (challengeLoader as any).validateChallengeDirectory(
          "/fake/path",
          "test",
        );
      }).toThrow(/Missing required file: validate.sh/);
    });

    it("should fix permissions on non-executable validate.sh", () => {
      mockExistsSync
        .mockReturnValueOnce(true) // challenge.yaml exists
        .mockReturnValueOnce(true) // validate.sh exists
        .mockReturnValueOnce(false); // setup.sh doesn't exist

      mockStatSync.mockReturnValueOnce({ mode: 0o644 }); // validate.sh not executable

      (challengeLoader as any).validateChallengeDirectory("/fake/path", "test");

      expect(mockChmodSync).toHaveBeenCalledWith(
        "/fake/path/validate.sh",
        "755",
      );
    });
  });
});
