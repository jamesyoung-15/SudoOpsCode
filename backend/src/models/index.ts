import { User } from "./User.js";
import { Challenge } from "./Challenge.js";
import { Solve } from "./Solve.js";
import { Attempt } from "./Attempt.js";
import { Favorite } from "./Favorite.js";

// Define associations
User.hasMany(Solve, { foreignKey: "user_id", as: "solves" });
User.hasMany(Attempt, { foreignKey: "user_id", as: "attempts" });
User.hasMany(Favorite, { foreignKey: "user_id", as: "favorites" });

Challenge.hasMany(Solve, { foreignKey: "challenge_id", as: "solves" });
Challenge.hasMany(Attempt, { foreignKey: "challenge_id", as: "attempts" });
Challenge.hasMany(Favorite, { foreignKey: "challenge_id", as: "favorites" });

Solve.belongsTo(User, { foreignKey: "user_id", as: "user" });
Solve.belongsTo(Challenge, { foreignKey: "challenge_id", as: "challenge" });

Attempt.belongsTo(User, { foreignKey: "user_id", as: "user" });
Attempt.belongsTo(Challenge, { foreignKey: "challenge_id", as: "challenge" });

Favorite.belongsTo(User, { foreignKey: "user_id", as: "user" });
Favorite.belongsTo(Challenge, { foreignKey: "challenge_id", as: "challenge" });

export { User, Challenge, Solve, Attempt, Favorite };
