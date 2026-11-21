# AGENTS.md

## Repository purpose

`harness-api` is a NestJS application that will run `@mikode13/harness` agents on a server. It
is a consumer of the harness, like `harness-cli`: agent behavior, provider error classification
and the agent contracts belong in the harness, never copied here. Today it stores sessions,
prompts and events in PostgreSQL behind an API key, and runs no agent yet; see the README's
status.

[`docs/architecture.md`](docs/architecture.md) owns the module map and the contract. Read it
before placing a change, and update it in the same pull request when a change moves a boundary
or a contract.

## Product design

The product's scope, glossary, flows and design live in
[`Mikode13/harness-docs`](https://github.com/Mikode13/harness-docs), which also covers the CLI
and the mobile app. Read its `README.md`, its `glossary.md` and the flow or design document of
the area before designing or implementing a feature here, and use the glossary's terms.

A change here that departs from one of those documents updates it there in the same batch of
work, with an entry in its `docs/decisions.md` that says why. This repository's `docs/` describe
this application: its architecture and the decisions that are its own. A decision about the
product that crosses its projects is recorded in `harness-docs`; one that is both is recorded
in both logs, each linking the other. A rule for every MiKode project is neither: it goes
through the ADR process of `Mikode13/engineering`.

## Constraints

- The mandatory test suite stays offline. It starts the application on a local port; once the
  harness is a dependency, its provider SDKs are replaced by fakes, never called.
- Build the application through `createApp` in `src/app.ts`, with the database it uses. Tests
  use it to start the same application the server runs, on a port of their own, over PGlite
  (`tests/support/`), so they need no PostgreSQL server.
- Every query is scoped to its user. The ids a client generates, a session's and a prompt's, are
  unique only within their user, so a lookup by such an id always names the user too.
- A migration in `src/database/migrations.ts` is never edited once it has shipped: a change is a
  new migration at the end.

## Hazards

- Nest injects constructor parameters by the type `emitDecoratorMetadata` records. A class that
  is injected must be imported as a value, not with `import type`, or the metadata names
  nothing and Nest cannot resolve the parameter. ESLint's type-import rule leaves these imports
  alone; do not "fix" them by hand.
- `reflect-metadata` is imported first in `src/app.ts`. Keep it before any Nest import there.
- Vitest emits decorator metadata from `tsconfig.json` on its own (checked on Vitest 4.1 with
  Vite 8), so no SWC plugin is needed. A Vitest or Vite upgrade that stops it makes every
  injection by type fail in the tests.
- Imports between source files end in `.ts`; `tsc` rewrites them to `.js` in `dist/`.

## Local validation

```sh
pnpm install --frozen-lockfile
pnpm run check   # prettier --check, eslint --max-warnings 0, tsc --noEmit for src and tests
pnpm test        # the offline integration suite
pnpm run build   # tsc into dist/
```

## Engineering standards

This repository follows the active standards in
[`Mikode13/engineering`](https://github.com/Mikode13/engineering/blob/main/standards/README.md).
Do not duplicate their content here; read them there when a change touches package management,
TypeScript, code quality, formatting, git workflow, testing or CI.
