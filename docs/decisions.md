# Decisions

## Agents run on the server only, at first

**Decision:** The API runs agents only on the server. For each session it clones the repository
and works in a worktree of its own, and the server keeps the history, the traces and the saved
conversations. Only Linux needs to be supported.

**Context:** The goal is to start and follow a coding task from anywhere, a phone included, and
to maintain one platform. A mode where the agent runs on the user's machine while the API only
stores and coordinates suits work that needs that machine; it is tracked in
[harness-cli#19](https://github.com/Mikode13/harness-cli/issues/19), with its questions open.

**Consequences:** The server pays for the agents' compute and disk, a higher infrastructure
cost that is accepted. Saving and restoring conversations depends on harness
[#111](https://github.com/Mikode13/harness/issues/111) and
[#136](https://github.com/Mikode13/harness/issues/136), which this API is the first consumer of.
None of this is built yet.

## NestJS 12 on Express, with legacy decorators

**Decision:** The API is a NestJS 12 application on its default Express platform. `tsconfig.json`
enables `experimentalDecorators` and `emitDecoratorMetadata`, and ESLint allows empty classes
that carry a decorator.

**Context:** NestJS was chosen for the API. Its dependency injection reads the types of
constructor parameters from the metadata legacy decorators emit; standard decorators emit none.
NestJS 12 ships as ES modules, so the project keeps the `"type": "module"` setup of other MiKode
projects. Vitest 4 on Vite 8 emits the same metadata from `tsconfig.json`, so tests need no SWC
plugin.

**Consequences:** A class that is injected is imported as a value, never with `import type`.
Both configuration changes are listed as exceptions in the README. Fastify, Nest's other HTTP
platform, was not evaluated; changing to it later touches `createApp` and any Express-specific
middleware.

## PostgreSQL through `pg`, PGlite in the tests, and migrations as SQL strings

**Decision:** The API keeps its state in PostgreSQL, through a small `Database` contract with
`query` and `transaction`, implemented on `pg`'s pool. The tests implement the same contract on
PGlite, PostgreSQL running inside the test's process. The schema is a list of SQL migrations in
`src/database/migrations.ts`, applied in order when the application is built and recorded in
`schema_migrations`.

**Context:** The product chose PostgreSQL and UUIDs of version 7 on 2026-11-21
([harness-docs decisions](https://github.com/Mikode13/harness-docs/blob/main/docs/decisions.md)).
This repository's suite must stay offline and start the application itself. PGlite runs the same
SQL as the server with no server and no container, so CI needs nothing more. The maintainer chose
it over a PostgreSQL container on 2026-11-21.

**Alternatives considered:**

- **A PostgreSQL container in the tests.** The same server as production, and it needs Docker in
  CI and on every machine that runs the suite.
- **An ORM or a query builder**, such as Drizzle or Kysely. Typed queries, at the cost of a layer
  over SQL while the schema is small and still settling; the `Database` contract keeps the
  choice open.
- **Migrations as `.sql` files.** They would need copying into `dist/`, which `tsc` does not do.

**Consequences:** Queries are written in SQL and their rows are typed at each call. A migration
that has shipped is never edited. PGlite and the server can differ in what extensions they offer;
the schema uses none. A smoke test against PostgreSQL 16 on 2026-11-21 passed the same requests.

## Every route needs an API key, kept as a hash

**Decision:** A global guard requires `Authorization: Bearer <key>` on every route but those marked
`@Public()`, which is only the health check. A key is stored as its SHA-256 hash, and a missing,
unknown or disabled key answers 401 the same way. The maintainer creates a user and its key on the
server with `pnpm run user:create -- <name>`, which prints the key once.

**Context:** The product gives each user one API key, kept as a hash and able to be disabled
([security](https://github.com/Mikode13/harness-docs/blob/main/design/security.md)). How the
maintainer creates one was left open there; a command on the server is the smallest way for the
MVP, whose only user is the maintainer.

**Alternatives considered:**

- **A slow password hash**, such as scrypt. A key is 32 random bytes, so there is nothing to guess
  that a slow hash would protect, and every request would pay for it.
- **An endpoint to create users.** It needs an administrator's authority, which the MVP does not
  have yet.

**Consequences:** Rotating or disabling a key is done in the database until a command exists.

## The first sessions: prompts accepted and stored, with no agent yet

**Decision:** `POST /sessions/:sessionId/prompts` accepts a prompt as the product's flows describe:
a known prompt id answers with its run, the first prompt creates the session, a deleted session
rejects it, a busy conversation rejects it, and the user's message is stored as the conversation's
next event. The run is created as `setting_up` and stays there, since nothing executes it yet. A
session's workspace can only be `none`, until registering projects is designed. `GET /sessions`
lists the user's sessions, and `GET /sessions/:sessionId/events?after=N` reads a conversation's
events after the last number a client saw.

**Context:** The first piece of the API that needs neither the harness nor the executor, built on
2026-11-21 while the harness's snapshot and run record are designed. The rules come from the flows
[create-session](https://github.com/Mikode13/harness-docs/blob/main/flows/create-session.md) and
[prompt-and-reconnect](https://github.com/Mikode13/harness-docs/blob/main/flows/prompt-and-reconnect.md).

**Consequences:** A session's second prompt is rejected as busy until something ends the first run;
the tests end it in the database. Subscribing to events as they happen, the executor, projects and
clearing come next.
