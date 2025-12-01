# Backend Documentation

This doc generated with LLM since I'm too lazy to write everything.

## Overview

The backend is a Node.js + Express + TypeScript application that manages challenge sessions, Docker containers, and user progress. It uses SQLite for data persistence and Docker for providing isolated Linux environments for each challenge session. Sessions are stored in memory due to time constraints, but it is sufficient.

## Key Workflows

### 1. Session & Container Management Workflow

The core workflow involves creating isolated Docker environments for users to solve challenges:

``` txt
User Request → Session Creation → Container Provisioning → WebSocket Connection → Terminal Interaction → Validation → Cleanup
```

#### Detailed Flow:

1. **Session Initialization** (`POST /api/sessions/start`)
   - User requests to start a challenge
   - System checks user's session limits (max 1 active session per user, max 15 total sessions)
   - Validates that user doesn't already have an active session for this challenge
   - Marks session as "pending" to prevent duplicate creation

2. **Container Provisioning** (`containerManager.ts`)
   - Creates a new Docker container from the `challenge-runner:v1.0` image
   - Mounts challenge-specific files into the container at `/challenge`
   - Configures resource limits (1 CPU, 512MB RAM)
   - Starts the container and retrieves connection details (container ID)

3. **Session Registration** (`sessionManager.ts`)
   - Records session in memory with metadata:
     - Session ID (UUID)
     - User ID and Challenge ID
     - Container ID
     - Timestamps (created, expires, last activity)
   - Sets expiration timers:
     - Idle timeout: 10 minutes of inactivity
     - Max session time: 15 minutes total

4. **WebSocket Connection** (`websocketService.ts`)
   - Client connects via WebSocket with authentication token
   - Server validates token and session ownership
   - Establishes bidirectional communication:
     - Client → Container: User terminal input
     - Container → Client: Terminal output
   - Executes shell in container: `/bin/bash`

5. **Session Activity**
   - Each WebSocket message updates `lastActivity` timestamp
   - Idle sessions are automatically cleaned up after 10 minutes
   - Sessions are forcibly terminated after 15 minutes

6. **Solution Validation** (`POST /api/sessions/:sessionId/validate`)
   - User submits solution for validation
   - System executes challenge's `validate.sh` script inside container
   - Script returns exit code: 0 = success, non-zero = failure
   - On success:
     - Awards points to user
     - Records solve in database
     - Updates user progress
   - On failure:
     - Records failed attempt
     - Increments attempt counter

7. **Cleanup** (`DELETE /api/sessions/:sessionId` or automatic)
   - Terminates Docker container
   - Removes session from memory
   - Cleans up resources
   - Can be triggered:
     - Manually by user
     - Automatically on idle timeout
     - Automatically on max session time
     - On validation success

### 2. Cleanup Job Workflow

Background job runs every 30 seconds (`cleanupJob.ts`):

```typescript
Check expired sessions → Stop containers → Remove sessions → Log cleanup
```

- Identifies sessions past their expiration time
- Stops and removes associated Docker containers
- Removes session records from memory
- Prevents resource leaks

## API Routes

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Create new user account | No |
| POST | `/login` | Login and receive JWT token | No |

### Session Routes (`/api/sessions`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/start` | Start a new challenge session | Yes |
| POST | `/:sessionId/validate` | Submit solution for validation | Yes |
| GET | `/:sessionId` | Get session information | Yes |
| GET | `/` | List user's active sessions | Yes |
| DELETE | `/:sessionId` | End a session manually | Yes |

**Example: Starting a Session**

```bash
POST /api/sessions/start
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "challengeId": 1
}

# Response:
{
  "sessionId": "f5b23ceb-4faa-4a31-88c3-11d9e2e0f16e",
  "expiresAt": "2025-12-01T08:49:10.739Z",
  "message": "Session started successfully"
}
```

**Example: Validating Solution**

```bash
POST /api/sessions/:sessionId/validate
Authorization: Bearer <jwt_token>

# Response (Success):
{
  "success": true,
  "message": "Congratulations! Challenge solved!",
  "points": 100
}

# Response (Failure):
{
  "success": false,
  "message": "Solution incorrect. Keep trying!"
}
```

### Challenge Routes (`/api/challenges`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/public` | List all challenges (paginated) | No |
| GET | `/` | List challenges with user progress | Yes |
| GET | `/:id` | Get specific challenge details | Yes |
| GET | `/:id/solution` | Get challenge solution | Yes |
| GET | `/stats/overview` | Get platform statistics | Yes |

### Favorites Routes (`/api/favorites`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List user's favorites (paginated) | Yes |
| POST | `/:challengeId` | Add challenge to favorites | Yes |
| DELETE | `/:challengeId` | Remove from favorites | Yes |
| GET | `/check/:challengeId` | Check if favorited | Yes |

### Progress Routes (`/api/progress`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get user's progress summary | Yes |
| GET | `/history` | Get solve history | Yes |

### Leaderboard Routes (`/api/leaderboard`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get top users by points | Yes |

## Key Services

### SessionManager (`services/sessionManager.ts`)

Manages active challenge sessions in memory.

**Key Methods:**

- `createSession(userId, challengeId, containerId)` - Create new session
- `getSession(sessionId)` - Retrieve session by ID
- `updateActivity(sessionId)` - Update last activity timestamp
- `endSession(sessionId)` - Terminate session and cleanup
- `getUserSessions(userId)` - Get all sessions for a user
- `getExpiredSessions()` - Find sessions that need cleanup
- `canCreateSession(userId)` - Check if user can create new session

**Session Limits:**

- 1 session per user maximum
- 15 total sessions across all users
- 10 minute idle timeout
- 15 minute maximum session duration

### ContainerManager (`services/containerManager.ts`)

Interfaces with Docker API to manage challenge containers.

**Key Methods:**

- `createContainer(challengeId)` - Create and start container
- `executeCommand(containerId, command)` - Run command in container
- `stopContainer(containerId)` - Stop and remove container
- `attachToContainer(containerId, ws)` - Attach WebSocket to container shell

**Container Configuration:**

```typescript
{
  Image: 'challenge-runner:v1.0',
  Cmd: ['/bin/bash'],
  Tty: true,
  OpenStdin: true,
  HostConfig: {
    Memory: 512 * 1024 * 1024,    // 512MB
    NanoCpus: 1000000000,          // 1 CPU
    NetworkMode: 'none',           // No network access
    AutoRemove: true,
  },
  Mounts: [{
    Type: 'bind',
    Source: '/path/to/challenge/files',
    Target: '/challenge',
    ReadOnly: true
  }]
}
```

### WebSocketService (`services/websocketService.ts`)

Manages WebSocket connections for terminal sessions.

**Connection Flow:**

1. Client connects: `ws://localhost:3008/terminal?token=<jwt>&sessionId=<uuid>`
2. Server validates JWT token
3. Server verifies session ownership
4. Server attaches to container shell
5. Bidirectional streaming begins:
   - Client input → Container stdin
   - Container stdout/stderr → Client

**Key Features:**

- JWT authentication on connection
- Session ownership verification
- Binary data support for terminal output
- Automatic cleanup on disconnect
- Heartbeat/ping-pong for connection health

### ProgressService (`services/progressService.ts`)

Tracks user progress and challenge completion.

**Key Methods:**

- `recordAttempt(userId, challengeId, success)` - Log validation attempt
- `recordSolve(userId, challengeId)` - Record successful solve, award points
- `hasSolved(userId, challengeId)` - Check if user solved challenge
- `getChallengePoints(challengeId)` - Get point value for challenge

**Progress Tracking:**

- Attempts table: Records each validation attempt (success/failure)
- Solves table: Records successful completions with timestamps
- User points: Automatically updated on first solve

## Database Schema

### Core Tables

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Challenges
CREATE TABLE challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  points INTEGER NOT NULL,
  category TEXT NOT NULL,
  solution TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Solves (first successful completion)
CREATE TABLE solves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  challenge_id INTEGER NOT NULL,
  solved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, challenge_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

-- Attempts (all validation attempts)
CREATE TABLE attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  challenge_id INTEGER NOT NULL,
  success INTEGER NOT NULL,
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

-- Favorites
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  challenge_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, challenge_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);
```

## Security Considerations

### Authentication

- JWT tokens with 24-hour expiration
- Bcrypt password hashing (10 rounds)
- Token validation on all protected routes

### Container Isolation

- No network access (`NetworkMode: 'none'`)
- Resource limits (CPU, memory)
- Read-only challenge file mounts
- Automatic cleanup on expiration
- Maximum session duration enforced

### Session Management

- Session ownership verification
- Single session per user limit
- Pending session tracking prevents race conditions
- Automatic cleanup prevents resource exhaustion

## Configuration

Environment variables (`.env`):

```bash
# Server
PORT=3008
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key-here

# Database
DB_PATH=./data/database.sqlite

# Docker
DOCKER_SOCKET=/var/run/docker.sock

# Session Limits
MAX_SESSIONS_PER_USER=1
MAX_TOTAL_SESSIONS=15
IDLE_TIMEOUT_MS=600000      # 10 minutes
MAX_SESSION_TIME_MS=900000  # 15 minutes
```

## Testing

Run unit tests:

```bash
npm run test
```

Test coverage includes:

- Authentication flow
- Container lifecycle management
- Session management
- Progress tracking
- Challenge loading

## Logging

Uses Pino for structured logging:

```typescript
logger.info({ userId, challengeId }, 'Session started');
logger.error({ error, sessionId }, 'Validation failed');
logger.debug('Docker API call', { containerId });
```

Log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
