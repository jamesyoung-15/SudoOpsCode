# SudoOpsCode

Basically Leetcode for Linux admin. Platform for solving Linux/DevOps challenges inside Docker containers on the web browser. Done for course project for METCS602.

Uses NodeJS + Express in backend w/ Docker containers for terminal environments.

## Preview

![](./media/AppPreview.png)

## Setup

### Local Dev

Developed on Linux host (NixOS).

#### Requirements

Ensure system has Docker and NodeJS installed.

#### Docker Setup

**Important**: First need to build the actual base Docker image that is used for each container. Run:

``` bash
docker build -f backend/challenges/Dockerfile.challenge -t challenge-runner:v1.0 .
```

This is the Docker image used for each container that corresponds to a terminal session. Without it backend will error out.

#### Backend Setup

``` bash
cd backend
npm run build
# for running unit tests
npm run test
npm run dev
```

#### Frontend Setup

``` bash
cd frontend
npm install
npm run dev
```

## Tech Stack

### Frontend

- React + Typescript + Vite
- React Router for routing
- Zustand for state management (eg. user token)
- CSS for styling
- Xtermjs for terminal connection
- React Markdown for rendering markdown

### Backend

- Node + Expressjs + Typescript
- SQLite3 as database
- Sequelize as ORM to interact w/ db
- Pino for logging
- Jest for unit testing
- JWT for auth
- Dockerode for interfacing Docker API w/ Node
- Websocket for connecting to terminal session live

## Architecture

## Documentation

See `docs` for some more notes about project.
