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
