# Database Schema

## Key relationships

- users <-> attempts: One-to-many (a user can have many attempts)
- users <-> solves: One-to-many (a user can solve many challenges)
- challenges <-> attempts: One-to-many (a challenge can have many attempts)
- challenges <-> solves: One-to-many (a challenge can be solved by many users)

Design Decisions:

- attempts table: Records every validation attempt (success or failure)
  - Used for analytics and tracking user progress
  - Can show "You've attempted this 5 times" feedback

- solves table: Denormalized first solve per user per challenge
  - Optimized for leaderboard queries
  - UNIQUE constraint prevents duplicate solves
  - Makes "Who solved what?" queries fast

- No sessions table: Sessions are ephemeral
  - Stored in-memory in SessionManager
  - No need to persist (containers are temporary)
  - Cleaned up after timeout or explicit end

- Simple indexes: Just on commonly queried fields
  - Username lookups (login)
  - Challenge filtering (difficulty, category)
  - User progress tracking (user_id, challenge_id)
