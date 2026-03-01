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

3. Start Postgres, wait for readiness, run migrations, and seed baseline data:

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

## Fully Automated Content Pipeline

The quiz now supports automated generation, validation, scheduling, publishing, and source freshness checks.

Pipeline stages:

1. `automation:generate` - create draft puzzles for future dates from `player_facts`
2. `automation:validate` - quality/freshness/no-repeat checks and publishability flags
3. `automation:schedule` - move publishable drafts to scheduled
4. `automation:publish` - publish today (with fallback)
5. `automation:refresh` - verify and hash source URLs for upcoming puzzles

Run all stages:

```bash
npm run automation:daily
```

Recommended daily cron (server/CI):

- `00:00 Europe/London`: `npm run automation:publish`
- `02:00 Europe/London`: `npm run automation:generate && npm run automation:validate && npm run automation:schedule && npm run automation:refresh`

### Automation tunables

- `npm run automation:generate -- --buffer-days=30 --cooldown-days=180`
- `npm run automation:schedule -- --window-days=30`
- `npm run automation:publish -- --date=YYYY-MM-DD`

## Scripts

- `npm run dev` - client only
- `npm run dev:server` - API only
- `npm run dev:full` - client + API together
- `npm run setup` - start DB, wait, migrate, and seed
- `npm run db:up` - start Postgres via Docker
- `npm run db:down` - stop Postgres container
- `npm run db:wait` - wait until DB accepts connections
- `npm run db:migrate` - apply SQL migration
- `npm run db:seed` - idempotent upsert seed from `src/data/puzzles.ts`
- `npm run automation:generate` - auto-generate draft puzzles
- `npm run automation:validate` - validate draft/scheduled puzzles
- `npm run automation:schedule` - schedule publishable drafts
- `npm run automation:publish` - publish the target day puzzle
- `npm run automation:refresh` - refresh source hashes and freshness
- `npm run automation:daily` - run full automation pipeline
- `npm test` - run test suite
- `npm run build` - type-check and build client
