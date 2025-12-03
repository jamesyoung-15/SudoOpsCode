import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/database.js";

interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  updated_at: Date;
}

interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    "id" | "email" | "created_at" | "updated_at"
  > {}

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare id: number;
  declare username: string;
  declare email: string;
  declare password: string;
  declare created_at: Date;
  declare updated_at: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "password_hash", // Maps to password_hash column in DB
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
    tableName: "users",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
