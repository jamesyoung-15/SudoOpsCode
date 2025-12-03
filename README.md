# SudoOpsCode

Basically Leetcode for Linux admin. Platform for solving Linux/DevOps challenges inside Docker containers on the web browser.

Frontend uses React + Vite + TS + CSS.

Backend uses Node + Express to manage challenge sessions, Docker containers, and user progress. After presentation added models to fully use Sequelize ORM instead of raw SQL (whoops).

SQLite used for database to store user info and Docker for providing isolated Linux environments for each challenge session, interacted through websockets.

## Setup

Tested on Linux host.

### Requirements

Ensure system has Docker and NodeJS installed.

Clone this repo, ie:

``` bash
git clone https://github.com/jamesyoung-15/sudoopscode
cd sudoopscode
```

### Backend Setup

Create `.env` inside `backend/`, it is mandatory to define a `JWT_SECRET` variable and you can also modify configuration variables seen in `backend/src/config/index.ts`. Example:

``` conf
JWT_SECRET=my_key
```

Then setup the Node backend:

``` bash
cd backend
npm run build
npm run dev

# for running unit tests
npm run test
```

By default, this starts the Express server on port 3008 (also set in frontend).

**Important**: If you do change frontend port, you need to add it to the CORS in the backend (in `backend/src/app.ts`).

### Frontend Setup

``` bash
cd frontend
npm install
npm run dev
```

By default, the frontend uses localhost:3008 as the API base URL. To change, create `.env` in `frontend` and can change to something like:

``` conf
VITE_API_BASE_URL=http://localhost:3008
VITE_WS_BASE_URL=ws://localhost:3008
```

## Cloud Deployment

For cloud deployment, I used Cloudflare as my DNS provider and CDN, AWS S3 to host frontend, Oracle Instance to host backend (API + database). Basically use Terraform to create public S3 bucket w/ Cloudflare domain pointing to bucket (cname), sync static frontend files to bucket, backend do manual deploy (could automate w/ Terraform + bash, possible todo).

Full instructions on free [setup](./docs/application_deployment.md)

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

### "Prod" Deployment

- AWS S3 for frontend
- Oracle Instance for backend (manual setup)
- Cloudflare for CDN, DNS provider
- Terraform for IaC (only for frontend)

## Hosting Diagram

![](./media/hosting-diagram.png)

## More Documentation

See [docs](./docs/README.md) for some more notes about project.
