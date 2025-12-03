import { DataTypes, Model, Optional, Association } from "sequelize";
import { sequelize } from "../db/database.js";
import type { Challenge } from "./Challenge.js";
import type { User } from "./User.js";

interface SolveAttributes {
  id: number;
  user_id: number;
  challenge_id: number;
  created_at: Date;
}

interface SolveCreationAttributes
  extends Optional<SolveAttributes, "id" | "created_at"> {}

export class Solve
  extends Model<SolveAttributes, SolveCreationAttributes>
  implements SolveAttributes
{
  declare id: number;
  declare user_id: number;
  declare challenge_id: number;
  declare created_at: Date;

  // Association helpers
  declare challenge?: Challenge;
  declare user?: User;

  declare static associations: {
    challenge: Association<Solve, Challenge>;
    user: Association<Solve, User>;
  };
}

Solve.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    challenge_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "challenges",
        key: "id",
      },
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "solved_at", // Maps to solved_at column in DB
    },
  },
  {
    sequelize,
    tableName: "solves",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "challenge_id"],
      },
    ],
  },
);
