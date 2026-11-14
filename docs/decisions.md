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

## Sessions hold conversations, and clearing archives

**Decision:** The user lists, opens, renames and deletes sessions. A session holds one active
conversation at a time, and clearing it archives that conversation and starts a new, empty one
in the same session. Deletion is logical first, and a real purge may come later. An archived
conversation can still be found; a deleted one is no longer returned by listing, opening or
retrieval. [`glossary.md`](glossary.md) defines the terms.

**Context:** The maintainer's example is the session for translations, whose workspace is a
worktree for translations: the session is cleared to start a different translations task and
keeps its title and workspace. A conversation per work item would tie the workspace to
something the user discards. R13 of [`mvp.md`](mvp.md) retrieves messages from other
conversations, so a clear cannot delete the conversation it replaces. Deleting is for what is
not worth remembering, such as a throwaway question.

**Consequences:** R01 is reworded around sessions and gains clearing, and the other
requirements change a word only where it meant something else. Issues that say "conversation"
or "task" keep their text until they are refined; the glossary lists where they differ. The
states of a run, the order and storage of events, and what a deletion does to archived
conversations are not decided; the glossary's open points hold the proposals.

## A session works in a workspace, whose roots are worktrees on the server

**Decision:** A session has one workspace, or none when it is not about code. A workspace is
where the harness works: one root or several, each a worktree or a project's main folder. A
worktree is a copy of a repository and nothing more. On the server of the MVP every root is a
worktree. [`glossary.md`](glossary.md) defines the terms.

**Context:** The harness can work in a worktree, in a project's main folder, or in several
projects at once, such as this API and the harness together, and its `workspace` option is
already a list of `roots`. Calling all of that a worktree named one case for the whole. The
session has the workspace, not the reverse, because the session is what the user lists and a
session without code has no workspace.

**Consequences:** R03 of [`mvp.md`](mvp.md) stays as it is: sessions on the same project use
separate worktrees. Two sessions on a project's main folder would write in the same place,
where the harness lets one run write at a time, so that form is left for local use. A
conversation has many runs, one per prompt, and each run has a state; which states is not
decided.

## A run executes in a child process of the API, one per run

**Decision:** The API starts one executor per run, as a child process. The executor runs the
harness for that run, talks only to the API over a local channel, and does not connect to the
database. The API is the only writer of the database and of a run's state.
[`run-lifecycle.md`](run-lifecycle.md) holds the rules.

**Context:** Agenda item 1 of [`mvp.md`](mvp.md). Inside the API's process, a run that hangs
or runs out of memory takes the API down, and the commands a model starts run as the user that
holds the database credentials. An executor as a service of its own would also survive a
restart of the API, but needs a channel that survives either side going away, a heartbeat and
a reconciliation. The maintainer chose the child process on 2026-11-14.

**Consequences:** A failing run leaves the API up, and killing its process always ends it. The
API sees an executor die because its process exits, with no heartbeat. A restart of the API
ends every executor, and their runs become `interrupted`. Issue
[#6](https://github.com/Mikode13/harness-api/issues/6) describes a separately runnable
executor that claims tasks from PostgreSQL; it keeps its text until it is refined. Moving the
executor out later does not change a run's states.

## A run has eight states, and a restart interrupts it

**Decision:** A run is `setting_up`, `running`, `waiting_for_input`, `cancelling`, `cancelled`,
`completed`, `failed` or `interrupted`, and the last four are final. A cancellation passes
through `cancelling` until the executor confirms that everything stopped. Cancelling rejects a
pending ask, and an answer that arrives later does not count. After a restart of the API, a
run that was not ended becomes `interrupted` and its pending ask is closed. A session cannot
be cleared or deleted while a run of its conversation is not ended; the API enforces it and
the clients mirror it.

**Context:** Agenda item 2 of [`mvp.md`](mvp.md). Issue
[#4](https://github.com/Mikode13/harness-api/issues/4) listed the states for a task with
`queued`; nothing is queued (R05), and what happens first is preparing the workspace, so it
is `setting_up`. Stopping a command's processes takes seconds, and a prompt accepted in that
time would write in the same workspace. An ask is a stored event, which a reconnecting client
gets again, but the run that asked lives in the executor and does not survive a restart.

**Consequences:** One run is active per conversation, and one writing run per workspace,
which on the server is the same rule. A question asked before a restart has to be asked again
by a new run; resuming it depends on harness
[#136](https://github.com/Mikode13/harness/issues/136). After a run that does not complete,
the user sees everything up to the last event and at most one message with the error, and the
next run recovers the conversation, compacting it when it is very large.
