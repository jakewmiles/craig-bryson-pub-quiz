# Craig Bryson Pub Quiz

Daily Wordle-style Championship stalwart quiz.

## Stack

- Client: React + Vite
- API: Fastify
- DB: Postgres

## Quick Start

Prerequisites: Docker Desktop and Node 20+.

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Start Postgres, wait for readiness, run migrations, and seed data:

```bash
npm run setup
```

4. Start client + server:

```bash
npm run dev:full
```

Client runs on `http://localhost:5173`, API runs on `http://localhost:3001`.

Quickest path after cloning:

```bash
npm install && cp .env.example .env && npm run setup && npm run dev:full
```

## Scripts

- `npm run dev` - client only
- `npm run dev:server` - API only
- `npm run dev:full` - client + API together
- `npm run setup` - start DB, wait, migrate, and seed
- `npm run db:up` - start Postgres via Docker
- `npm run db:down` - stop Postgres container
- `npm run db:wait` - wait until DB accepts connections
- `npm run db:migrate` - apply SQL migration
- `npm run db:seed` - seed puzzles from `src/data/puzzles.ts`
- `npm test` - run test suite
- `npm run build` - type-check and build client
