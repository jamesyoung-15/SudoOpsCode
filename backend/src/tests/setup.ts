import { Sequelize, DataTypes, Transaction } from "sequelize";

// Create in-memory SQLite for tests
export const testSequelize = new Sequelize({
  dialect: "sqlite",
  storage: ":memory:",
  logging: false,
});

let isInitialized = false;

export const initTestDatabase = async () => {
  if (isInitialized) {
    return;
  }

  try {
    // Test connection
    await testSequelize.authenticate();

    // Enable foreign keys
    await testSequelize.query("PRAGMA foreign_keys = ON");
    
    // Set journal mode to WAL for better concurrency
    await testSequelize.query("PRAGMA journal_mode = WAL");

    // Import models
    const { User } = await import("../models/User.js");
    const { Challenge } = await import("../models/Challenge.js");
    const { Attempt } = await import("../models/Attempt.js");
    const { Solve } = await import("../models/Solve.js");
    const { Favorite } = await import("../models/Favorite.js");

    // Initialize each model with test sequelize instance
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
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false,
          field: 'password_hash',
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
        sequelize: testSequelize,
        tableName: 'users',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );

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
        },
        points: {
          type: DataTypes.INTEGER,
          allowNull: false,
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
        sequelize: testSequelize,
        tableName: 'challenges',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );

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
        },
        challenge_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
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
        sequelize: testSequelize,
        tableName: 'attempts',
        timestamps: false,
        underscored: true,
      }
    );

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
        },
        challenge_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          field: 'solved_at',
        },
      },
      {
        sequelize: testSequelize,
        tableName: 'solves',
        timestamps: false,
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ['user_id', 'challenge_id'],
          },
        ],
      }
    );

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
        },
        challenge_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize: testSequelize,
        tableName: 'favorites',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
          {
            unique: true,
            fields: ['user_id', 'challenge_id'],
          },
        ],
      }
    );

    // Set up associations
    User.hasMany(Solve, { foreignKey: 'user_id', as: 'solves' });
    User.hasMany(Attempt, { foreignKey: 'user_id', as: 'attempts' });
    User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites' });

    Challenge.hasMany(Solve, { foreignKey: 'challenge_id', as: 'solves' });
    Challenge.hasMany(Attempt, { foreignKey: 'challenge_id', as: 'attempts' });
    Challenge.hasMany(Favorite, { foreignKey: 'challenge_id', as: 'favorites' });

    Solve.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Solve.belongsTo(Challenge, { foreignKey: 'challenge_id', as: 'challenge' });

    Attempt.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Attempt.belongsTo(Challenge, { foreignKey: 'challenge_id', as: 'challenge' });

    Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
    Favorite.belongsTo(Challenge, { foreignKey: 'challenge_id', as: 'challenge' });

    // Sync database (create tables)
    await testSequelize.sync({ force: true });

    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize test database:", error);
    throw error;
  }
};

export const cleanTestDatabase = async () => {
  if (!isInitialized) {
    await initTestDatabase();
  }

  try {
    // Clean all tables in correct order (respecting foreign keys)
    await testSequelize.query('DELETE FROM favorites');
    await testSequelize.query('DELETE FROM solves');
    await testSequelize.query('DELETE FROM attempts');
    await testSequelize.query('DELETE FROM challenges');
    await testSequelize.query('DELETE FROM users');
  } catch (error) {
    console.error("Failed to clean test database:", error);
    throw error;
  }
};

export const closeTestDatabase = async () => {
  try {
    await testSequelize.close();
    isInitialized = false;
  } catch (error) {
    throw error;
  }
};