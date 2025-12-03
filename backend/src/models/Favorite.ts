import { DataTypes, Model, Optional, Association } from "sequelize";
import { sequelize } from "../db/database.js";
import type { Challenge } from "./Challenge.js";
import type { User } from "./User.js";

interface FavoriteAttributes {
  id: number;
  user_id: number;
  challenge_id: number;
  created_at: Date;
}

interface FavoriteCreationAttributes
  extends Optional<FavoriteAttributes, "id" | "created_at"> {}

export class Favorite
  extends Model<FavoriteAttributes, FavoriteCreationAttributes>
  implements FavoriteAttributes
{
  declare id: number;
  declare user_id: number;
  declare challenge_id: number;
  declare created_at: Date;

  // Association helpers
  declare challenge?: Challenge;
  declare user?: User;

  declare static associations: {
    challenge: Association<Favorite, Challenge>;
    user: Association<Favorite, User>;
  };
}

Favorite.init(
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
    },
  },
  {
    sequelize,
    tableName: "favorites",
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
