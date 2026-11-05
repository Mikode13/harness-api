# harness-api architecture

This document describes the project's current architecture. Historical reasoning belongs in
`docs/decisions.md`; future designs are identified explicitly.

## Purpose and scope

`harness-api` is the HTTP server that will run `@mikode13/harness` agents for remote clients.
Today it is a NestJS application with one endpoint, `GET /health`. It does not depend on the
harness yet: sessions, agent runs, the clone and the worktree each session will work in, and
their persistence are future designs, decided in their own issues.

## Architectural shape

A flat NestJS application: one root module and one feature folder. That is proportional to a
single endpoint; feature modules are added as the API grows, each in a folder of its own under
`src/`.

## Responsibilities and boundaries

| Module                           | Owns                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`                    | The process: reads `PORT` (3000 when unset), builds the application and listens.                                                                                |
| `src/app.ts`                     | `createApp`, which builds the application without listening, with Nest's logger limited to errors and warnings, and with shutdown hooks so `SIGTERM` closes it. |
| `src/appModule.ts`               | The root module, which registers each feature's controllers.                                                                                                    |
| `src/health/healthController.ts` | `GET /health`, which answers `{"status":"ok"}` once the application has started.                                                                                |

Tests start the application through `createApp`, so they exercise the same module graph the
server runs.

## Dependencies and contracts

- **NestJS 12 on Express** (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`),
  with `reflect-metadata` and `rxjs` as its runtime peers.
- **The HTTP contract** is `GET /health`, answering 200 with `{"status":"ok"}`. Any other path
  answers Nest's 404.

## Constraints and trade-offs

- Nest's dependency injection reads constructor parameter types from legacy decorator metadata,
  so `tsconfig.json` enables `experimentalDecorators` and `emitDecoratorMetadata`. The README
  lists this and the ESLint rule option as exceptions to the shared configuration.
- The server is meant to run on a Linux server. Nothing in the scaffold depends on the
  platform yet.
