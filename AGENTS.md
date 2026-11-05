# AGENTS.md

## Repository purpose

`harness-api` is a NestJS application that will run `@mikode13/harness` agents on a server. It
is a consumer of the harness, like `harness-cli`: agent behavior, provider error classification
and the agent contracts belong in the harness, never copied here. Today it only starts and
answers `GET /health`; see the README's status.

[`docs/architecture.md`](docs/architecture.md) owns the module map and the contract. Read it
before placing a change, and update it in the same pull request when a change moves a boundary
or a contract.

## Constraints

- The mandatory test suite stays offline. It starts the application on a local port; once the
  harness is a dependency, its provider SDKs are replaced by fakes, never called.
- Build the application through `createApp` in `src/app.ts`. Tests use it to start the same
  application the server runs, on a port of their own.

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
