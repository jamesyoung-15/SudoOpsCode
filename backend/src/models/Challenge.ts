import { DataTypes, Model, Optional, Association } from "sequelize";
import { sequelize } from "../db/database.js";
import type { Solve } from "./Solve.js";
import type { Attempt } from "./Attempt.js";
import type { Favorite } from "./Favorite.js";

export type DifficultyLevel = "easy" | "medium" | "hard";

interface ChallengeAttributes {
  id: number;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  points: number;
  category: string;
  solution: string | null;
  directory: string;
  created_at: Date;
  updated_at: Date;
}

interface ChallengeCreationAttributes
  extends Optional<
    ChallengeAttributes,
    "id" | "solution" | "created_at" | "updated_at"
  > {}

export class Challenge
  extends Model<ChallengeAttributes, ChallengeCreationAttributes>
  implements ChallengeAttributes
{
  declare id: number;
  declare title: string;
  declare description: string;
  declare difficulty: DifficultyLevel;
  declare points: number;
  declare category: string;
  declare solution: string | null;
  declare directory: string;
  declare created_at: Date;
  declare updated_at: Date;

  // Association helpers
  declare solves?: Solve[];
  declare attempts?: Attempt[];
  declare favorites?: Favorite[];

  declare static associations: {
    solves: Association<Challenge, Solve>;
    attempts: Association<Challenge, Attempt>;
    favorites: Association<Challenge, Favorite>;
  };
}

Challenge.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    difficulty: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [["easy", "medium", "hard"]],
      },
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    solution: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    directory: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "challenges",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
