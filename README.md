# harness-api

An HTTP API that will run [`@mikode13/harness`](https://github.com/Mikode13/harness) agents on a
server, so a coding task can be started and followed from anywhere, a phone included, while the
agent works on the server's own clone of the repository.

## Status

The API stores its state in PostgreSQL and authenticates every request with an API key. It
accepts prompts, creates the session the first prompt names, and keeps each conversation's
events in one numbered order that a client reads from the last number it saw. It runs no agent
yet: a prompt's run stays `setting_up`, since the executor, its sandbox and the harness come
next, and a session can have no projects yet. Those are
designed in [`harness-docs`](https://github.com/Mikode13/harness-docs), including the
[run lifecycle](https://github.com/Mikode13/harness-docs/blob/main/design/run-lifecycle.md),
[data model](https://github.com/Mikode13/harness-docs/blob/main/design/data-model.md) and
[server-managed workspaces](https://github.com/Mikode13/harness-docs/blob/main/design/workspace-and-git.md).
These are target designs, not endpoints or services provided by this scaffold.

The MVP targets personal use by the maintainer. HTTPS, execution isolation and running agents
still need implementation and deployment setup. Onboarding other users and storing their credentials
are a later phase; see the
[security design](https://github.com/Mikode13/harness-docs/blob/main/design/security.md).

The project is source-available under the MIT License with the Commons Clause License Condition
v1.0; see [`LICENSE`](LICENSE). It is not published to npm: it deploys as a server.

## Requirements

- Node.js 22.x (22.13 or later) or 24.x, as the
  [Node.js version standard](https://github.com/Mikode13/engineering/blob/main/standards/nodejs-version.md)
  sets; `.nvmrc` selects 24 for development.
- pnpm, which switches itself to the version pinned in `package.json`.

## Run it

The API needs a PostgreSQL database, named by `DATABASE_URL`. It applies its migrations when it
starts.

```sh
pnpm install
pnpm run build
export DATABASE_URL=postgres://user:password@localhost:5432/harness
pnpm run user:create -- maintainer   # prints the user's id and its API key, once
pnpm start
```

The server listens on `PORT`, or 3000 when it is not set. Every request but `GET /health`
carries the key:

```sh
curl http://localhost:3000/health
# {"status":"ok"}
curl -X POST http://localhost:3000/sessions/<session id>/prompts \
  -H "Authorization: Bearer <key>" -H 'Content-Type: application/json' \
  -d '{"promptId":"<prompt id>","text":"Hello","workspace":"none"}'
```

The ids of a session and of a prompt are UUIDs of version 7, which the client generates.

## Development

```sh
pnpm run check          # Prettier, ESLint and tsc for src and tests
pnpm test               # the offline integration suite, on PGlite: no PostgreSQL server needed
pnpm run test:coverage  # the same suite with V8 coverage of src
```

`pre-push` runs `pnpm run check && pnpm test`, and CI repeats both and adds the build.

## Architecture

[`docs/architecture.md`](docs/architecture.md) describes the modules, their boundaries and the
application's contract. [`docs/decisions.md`](docs/decisions.md) records why it is built this
way.

The product this server is part of, with its scope, glossary and flows, is designed in
[`Mikode13/harness-docs`](https://github.com/Mikode13/harness-docs).

## Exceptions to the shared configuration

NestJS reads the types of constructor parameters from decorator metadata to inject them, which
standard decorators do not emit:

- `tsconfig.json` enables `experimentalDecorators` and `emitDecoratorMetadata`, which the
  [TypeScript standard](https://github.com/Mikode13/engineering/blob/main/standards/typescript.md)
  does not set. They add no strictness option and weaken none.
- `eslint.config.js` configures the shared `@typescript-eslint/no-extraneous-class` rule with
  `allowWithDecorator`, because a Nest module is an empty class that its decorator configures.
  An undecorated empty class is still an error.
