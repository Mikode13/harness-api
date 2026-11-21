# harness-api architecture

This document describes the project's current architecture. Historical reasoning belongs in
`docs/decisions.md`; future designs are identified explicitly.

## Purpose and scope

`harness-api` is the HTTP server that will run `@mikode13/harness` agents for remote clients.
Today it is a NestJS application that keeps its state in PostgreSQL, authenticates every request
with an API key, accepts prompts and keeps each conversation's events in order. It does not
depend on the harness yet: running a prompt, the executor and its sandbox, and the workspace a
session works in are future designs, in
[harness-docs](https://github.com/Mikode13/harness-docs).

## Architectural shape

A flat NestJS application: one root module, built with the database, and a folder per concern
under `src/`. Feature modules are added when a concern needs its own providers.

## Responsibilities and boundaries

| Module                               | Owns                                                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`                        | The process: reads `PORT` (3000 when unset) and `DATABASE_URL`, which it requires, builds the application and listens.                                                           |
| `src/app.ts`                         | `createApp({ database })`, which migrates the database and builds the application without listening, with Nest's logger limited to errors and warnings, and with shutdown hooks. |
| `src/appModule.ts`                   | The root module, built with the database: the controllers, `SessionsService` and the API key guard on every route.                                                               |
| `src/database/database.ts`           | The `Database` and `Queryable` contracts and their injection token. Production and tests use the same contract.                                                                  |
| `src/database/postgresDatabase.ts`   | The `Database` on a PostgreSQL server, through `pg`'s pool.                                                                                                                      |
| `src/database/migrations.ts`         | The schema as ordered SQL migrations, and `migrate`, which applies those the database lacks, each in a transaction, and records them in `schema_migrations`.                     |
| `src/auth/apiKeys.ts`                | Creating a user with its key, hashing a key and finding the user a key belongs to. Only the SHA-256 hash of a key is stored.                                                     |
| `src/auth/apiKeyGuard.ts`            | The guard on every route: `Authorization: Bearer <key>`, rejected the same way when missing, unknown or disabled. `@Public()` opens a route, which only the health check is.     |
| `src/sessions/sessionsController.ts` | The session routes and the validation of what a client sends: ids that are UUIDs of version 7, a text, and the workspace.                                                        |
| `src/sessions/sessionsService.ts`    | Accepting a prompt, listing sessions and reading a conversation's events, every query scoped to its user.                                                                        |
| `src/health/healthController.ts`     | `GET /health`, which answers `{"status":"ok"}` once the application has started, without a key.                                                                                  |
| `src/createUser.ts`                  | `pnpm run user:create -- <name>`: creates a user on the server and prints its key once.                                                                                          |

Tests start the application through `createApp` over PGlite, PostgreSQL inside the test's
process (`tests/support/pgliteDatabase.ts`), so they exercise the same module graph and SQL the
server runs, with no server and offline.

## Data

PostgreSQL, through migration 1 in `src/database/migrations.ts`. It follows the conceptual
[data model](https://github.com/Mikode13/harness-docs/blob/main/design/data-model.md):

- **`users`** and **`api_keys`**: a key is stored as its hash and can be disabled.
- **`sessions`**: keyed by `(user_id, id)`, since a client generates the id and it is unique only
  within its user. `workspace` is only `none` for now.
- **`conversations`**: at most one active per session, by a partial unique index; clearing
  will archive it. `next_event_number` is the conversation's count of events.
- **`runs`**: one per prompt. `(user_id, prompt_id)` is unique, so a prompt sent again names the
  same run, and a partial unique index keeps one run per conversation not ended.
- **`events`**: keyed by `(conversation_id, number)`. A user's message is an event of no run, with
  its author; an event a run reports will name its run. Each carries its schema's version.

Every id the server makes is a UUID of version 7, from `uuid`.

## Accepting a prompt

In one transaction: a prompt id the user already sent answers with its run, before any other
check. Otherwise the session is created when the user has none with that id, with a default
title from the prompt's text, and rejected when it is deleted. A conversation with a run not ended
rejects the prompt as busy. The run is created as `setting_up`, and the user's message is stored
with the conversation's next number. Two copies of one prompt racing are settled by the unique
constraint: the second finds what the first stored.

## Dependencies and contracts

- **NestJS 12 on Express** (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`),
  with `reflect-metadata` and `rxjs` as its runtime peers.
- **PostgreSQL**, through `pg`, and **PGlite** (`@electric-sql/pglite`) for the tests, a
  development dependency only. **`uuid`** makes UUIDs of version 7 and validates the client's.
- **The HTTP contract.** Every route but the health check needs `Authorization: Bearer <key>` and
  answers 401 without a valid one.
  - `GET /health`: 200 `{"status":"ok"}`.
  - `POST /sessions/:sessionId/prompts` with `{ promptId, text, workspace? }`: 201 with
    `{ sessionId, conversationId, runId }` for a new prompt, 200 with the same body for a
    prompt id already sent. 400 for an id that is not a UUID of version 7 or an empty text, 422
    for a first prompt without `"workspace": "none"`, 409 while a run of the conversation is not
    ended, and 410 for a deleted session.
  - `GET /sessions`: the user's sessions that are not deleted, newest first, as
    `{ id, title, createdAt }`.
  - `GET /sessions/:sessionId/events?after=N`: the active conversation's events numbered after
    `N` (0 when omitted), in order, as `{ conversationId, events }`; 404 for a session the user
    does not have.
  - Any other path answers Nest's 404.

## Constraints and trade-offs

- Nest's dependency injection reads constructor parameter types from legacy decorator metadata,
  so `tsconfig.json` enables `experimentalDecorators` and `emitDecoratorMetadata`. The README
  lists this and the ESLint rule option as exceptions to the shared configuration.
- The server is meant to run on a Linux server. Nothing in the scaffold depends on the
  platform yet.
