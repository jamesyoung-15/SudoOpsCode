# API Endpoints

May not include every single endpoint, but these are key ones.

## Key API Endpoints Summary

### Authentication

- POST /api/auth/register - Create new user
- POST /api/auth/login - Login and get JWT token

### Sessions

- POST /api/sessions/start - Start a challenge session
- GET /api/sessions/:id - Get session info
- POST /api/sessions/:id/validate - Submit solution for validation
- DELETE /api/sessions/:id - End session
- GET /api/sessions - List user's active sessions

### Challenges

- GET /api/challenges - List all challenges (with progress)
- GET /api/challenges/:id - Get challenge details
- GET /api/challenges/public - Public challenge list (no auth)

### WebSocket

- WS /terminal?token=JWT&sessionId=UUID - Real-time terminal

### User Favorite Challenges

- GET /api/favorites - Get user favorited challenges
- POST /api/favorites/:id - Add challenge to favorites
- DELETE /api/favorites/:id - Remove challenge from favorites
- GET /api/favorites/check/:id - Check if single challenge is favorited

### Progress & Leaderboard (not used)

- GET /api/progress - User's progress
- GET /api/leaderboard - Top solvers
