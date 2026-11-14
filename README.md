# harness-api

An HTTP API that will run [`@mikode13/harness`](https://github.com/Mikode13/harness) agents on a
server, so a coding task can be started and followed from anywhere, a phone included, while the
agent works on the server's own clone of the repository.

## Status

This is the initial scaffold. The application starts and answers `GET /health`, and nothing else:
it does not depend on the harness yet, and it has no sessions, agents or persistence. Those are
designed in their own issues. The intended direction, agents that run only on the server with a
clone and a worktree per session, is recorded in [`docs/decisions.md`](docs/decisions.md), and is
not built yet.

The project is source-available under the MIT License with the Commons Clause License Condition
v1.0; see [`LICENSE`](LICENSE). It is not published to npm: it deploys as a server.

## Requirements

- Node.js 22.13 or later, or 24, as the
  [Node.js version standard](https://github.com/Mikode13/engineering/blob/main/standards/nodejs-version.md)
  sets; `.nvmrc` selects 24 for development.
- pnpm, which switches itself to the version pinned in `package.json`.

## Run it

```sh
pnpm install
pnpm run build
pnpm start
```

The server listens on `PORT`, or 3000 when it is not set:

```sh
curl http://localhost:3000/health
# {"status":"ok"}
```

## Development

```sh
pnpm run check          # Prettier, ESLint and tsc for src and tests
pnpm test               # the offline integration suite
pnpm run test:coverage  # the same suite with V8 coverage of src
```

`pre-push` runs `pnpm run check && pnpm test`, and CI repeats both and adds the build.

## Architecture

[`docs/mvp.md`](docs/mvp.md) defines the agreed product scope, exclusions and acceptance
criteria across the harness, API, CLI and mobile app. It describes the target product;
the implementation status above still applies.

[`docs/glossary.md`](docs/glossary.md) defines the product's terms, such as session,
conversation, run and event.

[`docs/run-lifecycle.md`](docs/run-lifecycle.md) defines where a run executes, its states and
what is left when it ends. It is a design, not built yet.

[`docs/architecture.md`](docs/architecture.md) describes the modules, their boundaries and the
application's contract. [`docs/decisions.md`](docs/decisions.md) records why it is built this
way.

## Exceptions to the shared configuration

NestJS reads the types of constructor parameters from decorator metadata to inject them, which
standard decorators do not emit:

- `tsconfig.json` enables `experimentalDecorators` and `emitDecoratorMetadata`, which the
  [TypeScript standard](https://github.com/Mikode13/engineering/blob/main/standards/typescript.md)
  does not set. They add no strictness option and weaken none.
- `eslint.config.js` configures the shared `@typescript-eslint/no-extraneous-class` rule with
  `allowWithDecorator`, because a Nest module is an empty class that its decorator configures.
  An undecorated empty class is still an error.
