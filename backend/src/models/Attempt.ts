import { DataTypes, Model, Optional, Association } from "sequelize";
import { sequelize } from "../db/database.js";
import type { Challenge } from "./Challenge.js";
import type { User } from "./User.js";

interface AttemptAttributes {
  id: number;
  user_id: number;
  challenge_id: number;
  success: boolean;
  attempted_at: Date;
}

interface AttemptCreationAttributes
  extends Optional<AttemptAttributes, "id" | "attempted_at"> {}

export class Attempt
  extends Model<AttemptAttributes, AttemptCreationAttributes>
  implements AttemptAttributes
{
  declare id: number;
  declare user_id: number;
  declare challenge_id: number;
  declare success: boolean;
  declare attempted_at: Date;

  // Association helpers
  declare challenge?: Challenge;
  declare user?: User;

  declare static associations: {
    challenge: Association<Attempt, Challenge>;
    user: Association<Attempt, User>;
  };
}

Attempt.init(
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
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    attempted_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "attempts",
    timestamps: false,
    underscored: true,
  },
);
