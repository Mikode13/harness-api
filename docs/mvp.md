# MiKode product MVP

Scope consolidated on 2026-11-11; the vocabulary was defined on 2026-11-13 and is in the
[glossary](glossary.md). This document records the agreed product requirements
across the harness, API, CLI and mobile app. It defines the target, not the current
implementation: the API is still a health-endpoint scaffold. See
[architecture.md](architecture.md) for its current architecture and
[roadmap issue #1](https://github.com/Mikode13/harness-api/issues/1) for delivery tracking.

This is the scope reference for the MVP. Older issue descriptions that place custom
agents, workflows, conversation retrieval or plans after the MVP are superseded by this
scope. Implementation proposals in issues remain subject to the system-design process.

## Purpose

Provide one personal place for conversations with MiKode agents. Start work from a CLI,
turn off the laptop while execution continues on the server, and continue the same
conversation from a mobile app. Change agents or supported models without manually
copying conversation history between products.

The project also serves as a practical way to learn technical leadership, agent systems,
persistence and context engineering. Design decisions should explain alternatives,
tradeoffs and the reason for the selected approach before implementation starts.

## Constraints and responsibility direction

- Personal use. Team collaboration, organizations, roles and a multi-tenant product are
  outside the MVP. Access from the user's devices still needs authentication; its method
  belongs to system design.
- The harness owns agent execution, LLM interaction, tools and workflow behavior. Product
  persistence and cross-device access belong to the backend. CLI and mobile own human
  interaction. Detailed interfaces and context ownership remain to be designed.
- Workflows use direct LLM integrations through the harness. Agent SDKs may remain useful
  for separate tasks such as CI review, but do not form this product's execution backbone.
- Execution happens on a Linux server, including repository preparation and code changes.
  The laptop is not required to remain connected or powered on.
- The core targets macOS and Linux; Windows core execution is excluded. Windows is in
  scope as a remote CLI client, alongside macOS and Linux clients.
- The clients are the CLI and a mobile app. Mobile platform coverage and interaction
  details are design decisions; a web UI and VS Code extension are excluded.
- Provider access and credentials must support the selected direct LLM integration.
  This scope does not promise that a consumer chat subscription supplies API access.

## Functional requirements and acceptance

Each requirement below is required for the complete MVP. Acceptance describes observable
behavior; it does not prescribe an endpoint, schema or event transport.

### R01 — Own sessions

Create, list, open, rename and delete sessions created in MiKode. Append messages to a
session's conversation. Clear a session: its current conversation is archived and a new,
empty one starts in the same session, which keeps its title. Importing external chats and
editing past message content are excluded. Persist the session and its conversations
rather than depending on a client's local history or a provider's chat interface.

**Acceptance:** Create a session, exchange messages, rename it and reopen it after a
client restart with the same title and history. Clear it and verify that the session keeps
its title, the new conversation is empty and the earlier conversation still exists,
archived. Delete a session and verify it is no longer available through normal session
listing, opening or retrieval tools.

### R02 — Continue across devices

The CLI and mobile app access the same sessions, conversations, messages and execution
status.
Device updates use events, and reconnecting clients recover the current state and missed
conversation content. Disconnecting a client does not cancel execution.

**Acceptance:** Send a prompt from the CLI, close it and power off the laptop. Open that
session on mobile, see the previous messages and ongoing work, and continue there.
Reopen the CLI and see the messages and outcome produced while it was disconnected.

### R03 — Execute on server-managed workspaces

Prepare the requested repository on the server and execute code work there. Independent
coding sessions use separate worktrees, including when they work on the same project.

**Acceptance:** Start two coding sessions on the same repository concurrently. Each has
its own worktree and changes; editing or restoring code in one leaves the other's work
unchanged. Both continue without their originating client connections.

### R04 — Change agent or model

Allow repeated changes between supported agents and models within a conversation. Retain
its visible history and provide the relevant owned context to the next execution. Cancel
active work before switching. The CLI warns that switching can increase cost and affect
provider-cache reuse; identical behavior or transfer of provider-private state is not
promised.

**Acceptance:** Establish a fact or decision in a conversation, switch agent/model, and
continue with that information available without copying the chat. The history remains
visible and the CLI displays the cost/cache warning. A switch does not start overlapping
executions in that conversation.

### R05 — Cancel and submit a new prompt

Allow the user to cancel active work and then send a new prompt. Do not queue new prompts
or inject them into an active run. When another device submits an ordinary prompt while
the conversation is busy, report that state instead of silently queueing it. Answering a
pending question or approval remains available.

**Acceptance:** Cancel from a connected client, observe execution stop, and successfully
send a follow-up. Submit an ordinary prompt from a second device while a run is active
and see a clear busy outcome with no later automatic execution. Disconnecting alone does
not trigger cancellation. Exact keyboard gestures remain a client design detail.

### R06 — Answer questions and approvals

Persist pending human interactions, the asks not yet answered, so they can be viewed and
answered from either client. A question should not depend on the terminal that started the
execution.

**Acceptance:** An agent pauses for input or approval. Close the CLI, answer from mobile,
and observe the corresponding work continue. Both devices reflect the resolved request;
answering the same request again does not resume the work twice.

### R07 — Observe progress and receive notifications

Show brief factual activity such as tool use, planning and file modification, without
token-by-token model output. Identify the acting agent or workflow stage when needed to
understand multi-agent work. Send notification events for pending questions/approvals,
completion and errors that stop execution. A notifier delivers these to CLI and mobile.

**Acceptance:** Observe concise activity during a run and receive a mobile notification
while the app is in the background for a pending human interaction and a terminal outcome.
Opening the notification reaches the relevant session. An attached CLI reflects the
same state. Alerts on both devices are acceptable; presence-based suppression is deferred.

### R08 — Recover after failure

Preserve recorded conversation history and completed work through server/executor
restarts. Restore execution only from supported safe checkpoints. If in-flight work
cannot be safely resumed, show it as interrupted and let the user decide how to continue.
Persisting messages alone is not sufficient to restore the agent's execution state.

**Acceptance:** Restart after a supported checkpoint and continue with its recorded state.
Interrupt unsupported in-flight work and verify that it is visibly interrupted rather
than silently replaying commands. Previously persisted messages and completed code
changes remain available. Document the supported recovery boundaries.

### R09 — Inspect and restore code

Let the user inspect changes and restore a retained code checkpoint through the client.
Restoring affects code, not the visible conversation history. Reuse the harness's recovery
capability rather than defining a second code-history engine in the API.

**Acceptance:** Make changes, inspect them and restore a preceding retained checkpoint.
Verify the expected code state, preservation of visible messages and an accurate reported
outcome if restoration is partial. Subsequent agent work is informed that code was restored.

### R10 — Create reusable agents and workflows

Create, edit, save and reuse agents and compose them into workflows without changing
application source code or redeploying the product for each definition. Allow manual
selection. Support a router that can choose from the available agents/workflows and ask
the user when the choice is unclear. The definition format and whether selections are
global or conversation-specific remain design decisions.

**Acceptance:** Save a custom agent and workflow, reopen them after a restart and execute
the workflow using the saved definitions. Edit a definition and use the edited version
in subsequent work. Select manually in one scenario and resolve an ambiguous router
choice through a question in another. Demonstrate a coding workflow with planner,
explorer, executor, reviewer and committer roles.

### R11 — Delegate within a conversation

Allow an agent to invoke another agent within the same conversation, in addition to the
independent parallel sessions in R03. Preserve enough attribution to understand delegated
results, progress and questions.

**Acceptance:** A parent agent delegates a task, receives the result and continues the
conversation. A delegated question can be answered through the normal human-interaction
flow, and cancelling the parent stops its associated delegated work.

### R12 — Own explicit memory and plans

Persist the full conversation independently of selected model context. Also provide
explicit tools to create, retrieve/query, modify and delete memories and plans. Plans are
chat artifacts; memories are reusable information, not aliases for the entire transcript.

Store plans and memories centrally in separate database tables, as agreed in the latest
scope discussion. This replaces the earlier proposal to keep plans only in server files.
Their fields, associations, labels, retention and query strategy remain to be designed.
Do not depend on private Claude or Codex client folders.

**Acceptance:** Through agent tools, create a memory and a conversation-linked plan,
retrieve them after a server restart and from another device, update them and retrieve
the updated content. Delete them and verify normal queries no longer return them. Use
a retrieved memory in a later conversation without manually copying its text.

### R13 — Retrieve other MiKode conversations

Provide tools to find and read relevant messages from the user's other MiKode
conversations, archived ones included. This is separate from explicit memory and plan
retrieval, and does not require importing conversations from other products.

**Acceptance:** From conversation B, find and retrieve a relevant message from conversation
A with a reference to its origin. An archived conversation is still found; a deleted
conversation is no longer returned. Retrieved content is available for the response without
inserting all past chats into every prompt.

### R14 — Search the public web and read sources

Provide distinct search and page-reading capabilities. Return source links with search
results and readable page content, including when the user supplies the URL. Keep the
tools independent of the selected LLM provider. Provider selection is still a design
decision; browser automation is excluded.

**Acceptance:** Search a topic, read a selected result and answer using its content with
the source URL retained. Read a directly supplied public URL. Unavailable pages and
truncated results produce explicit outcomes rather than implying a successful full read.
Implementation tracking: [harness#174](https://github.com/Mikode13/harness/issues/174).

## MVP completion gates

These gates group the requirements for verification, not a fixed implementation order.
Record the tested revision, scenario and result when a gate is demonstrated. Existing
core functionality still needs integration verification in the complete product.

- **Sessions and remote execution:** demonstrate R01, R02 and R03, including powering
  off the initiating laptop and running two isolated sessions on the same repository.
- **Human control and visibility:** demonstrate R05, R06 and R07 on CLI and mobile,
  including reconnecting, a question, an approval, cancellation, completion and a failure.
- **Continuity and code recovery:** demonstrate R04, R08 and R09, including a model switch,
  a supported checkpoint restore, an interrupted run and code restoration.
- **Agent composition:** demonstrate R10 and R11 with saved definitions, manual selection,
  router clarification and delegation in one conversation.
- **Owned context and external information:** demonstrate R12, R13 and R14, including
  memory/plan CRUD, cross-conversation retrieval and public web source reading.

The MVP is complete when all gates pass on the deployed personal setup. A usable remote
chat slice is an intermediate milestone, not completion of the entire agreed scope.
No throughput target or arbitrary latency SLA is introduced by this document.

## Explicit exclusions

- Team collaboration, organization management and multi-tenant product features.
- A separate web UI, VS Code extension and graphical workflow designer.
- Windows execution of the core and a local executor coordinated by the API.
- Agent SDKs as the workflow backbone or guaranteed reuse of chat subscriptions.
- External chat imports and editing historical messages.
- Token-by-token streaming, queued prompts and mid-run steering with new user messages.
- Automatic background memory consolidation or "dreaming".
- Guaranteed resume at any instruction or transparent replay of interrupted side effects.
- Smart notification suppression across devices.
- Browser automation, authenticated browsing, a general crawler or a search engine.
- Distributed scaling infrastructure before measured demand justifies it.

## System-design agenda

The functional scope is closed. The following questions determine how to deliver it;
they are not permission to silently add features or declare existing proposals settled.

1. Define component responsibilities and deployment boundaries for harness, API, execution,
   notifier and clients. Start with a diagram and a responsibility table.
2. Define the lifecycle states and transitions of sessions, conversations and runs, whose
   terms are in the glossary, including deletion during active work, cancellation, pending
   input and reconnects.
3. Define persistence and safe recovery boundaries. Distinguish visible history, model
   context, execution checkpoints, code history and delivery events.
4. Design context assembly: instructions, current messages, selected history, memories,
   plans, project context and tool results. Compare selection strategies, token budgets,
   compaction, freshness/expiration and behavior across model switches.
5. Design information organization and retrieval: fixed versus dynamic fields, topics or
   labels, associations, updates, deletion and any retained references.
6. Define saved agent/workflow configuration, router choices, selection scope, delegation
   and worktree coordination. Reconcile existing core capabilities with the product.
7. Define event delivery, synchronization, notification behavior and minimal client flows,
   including mobile platform coverage and device authentication.

Work through one topic at a time: state the problem, compare practical alternatives and
their tradeoffs, agree on an approach, and document it with an appropriate diagram before
moving to the next. Then refine implementation issues and their measurable milestones.

## Delivery references

- [API roadmap](https://github.com/Mikode13/harness-api/issues/1): delivery index; issue
  implementation detail is provisional until the corresponding design is agreed.
- [Agents (#15)](https://github.com/Mikode13/harness-api/issues/15),
  [workflows (#16)](https://github.com/Mikode13/harness-api/issues/16),
  [conversation retrieval (#17)](https://github.com/Mikode13/harness-api/issues/17) and
  [plans (#18)](https://github.com/Mikode13/harness-api/issues/18) are in the MVP.
- [Single-agent persistence](https://github.com/Mikode13/harness/issues/111) and
  [composed persistence](https://github.com/Mikode13/harness/issues/136) track relevant
  core contracts; links do not assert their current implementation status.
- [Remote CLI](https://github.com/Mikode13/harness-cli/issues/18) and
  [mobile delivery](https://github.com/Mikode13/harness-api/issues/13) track the clients.
- Explicit memory/context assembly and router integration need their implementation
  breakdown during system design; they remain included even where no dedicated API
  issue exists yet. The roadmap is not a substitute for the requirements above.
