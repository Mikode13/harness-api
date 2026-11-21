import type { Database } from './database.ts';

/**
 * The schema, as the migrations that build it, in order. A migration is never edited once it
 * has shipped: a change is a new one at the end. They are kept as strings, so `tsc` ships them
 * in `dist/` with no copy step.
 */
const migrations: readonly { version: number; sql: string }[] = [
	{
		version: 1,
		sql: `
CREATE TABLE users (
	id uuid PRIMARY KEY,
	name text,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
	id uuid PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES users (id),
	key_hash text NOT NULL UNIQUE,
	created_at timestamptz NOT NULL DEFAULT now(),
	disabled_at timestamptz
);

-- A client generates a session's id, and it is unique only within its user.
CREATE TABLE sessions (
	user_id uuid NOT NULL REFERENCES users (id),
	id uuid NOT NULL,
	title text NOT NULL,
	title_set_by_user boolean NOT NULL DEFAULT false,
	workspace text NOT NULL CHECK (workspace IN ('none')),
	created_at timestamptz NOT NULL DEFAULT now(),
	deleted_at timestamptz,
	PRIMARY KEY (user_id, id)
);

CREATE TABLE conversations (
	id uuid PRIMARY KEY,
	user_id uuid NOT NULL,
	session_id uuid NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	archived_at timestamptz,
	next_event_number bigint NOT NULL DEFAULT 1,
	FOREIGN KEY (user_id, session_id) REFERENCES sessions (user_id, id)
);

-- A session has one active conversation; clearing archives it.
CREATE UNIQUE INDEX conversations_one_active
	ON conversations (user_id, session_id) WHERE archived_at IS NULL;

CREATE TABLE runs (
	id uuid PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES users (id),
	conversation_id uuid NOT NULL REFERENCES conversations (id),
	prompt_id uuid NOT NULL,
	state text NOT NULL CHECK (state IN (
		'setting_up', 'running', 'waiting_for_input', 'cancelling',
		'cancelled', 'completed', 'failed', 'interrupted'
	)),
	created_at timestamptz NOT NULL DEFAULT now(),
	ended_at timestamptz,
	-- A prompt sent again is the same prompt: its id names one run, within its user.
	CONSTRAINT runs_prompt_once UNIQUE (user_id, prompt_id)
);

-- One active run per conversation: a prompt sent while one is not ended is rejected as busy.
CREATE UNIQUE INDEX runs_one_active ON runs (conversation_id)
	WHERE state IN ('setting_up', 'running', 'waiting_for_input', 'cancelling');

-- What a client shows of a conversation, in one numbered order. The user's message is an event
-- of no run; an event a run reported names its run.
CREATE TABLE events (
	conversation_id uuid NOT NULL REFERENCES conversations (id),
	number bigint NOT NULL,
	run_id uuid REFERENCES runs (id),
	author_user_id uuid REFERENCES users (id),
	type text NOT NULL,
	schema_version integer NOT NULL,
	payload jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (conversation_id, number)
);
`,
	},
];

/** Applies, in order and each in its own transaction, the migrations the database lacks. */
export async function migrate(database: Database): Promise<void> {
	await database.query(
		'CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
	);
	const { rows } = await database.query<{ version: number }>(
		'SELECT version FROM schema_migrations',
	);
	const applied = new Set(rows.map(row => row.version));
	for (const migration of migrations) {
		if (applied.has(migration.version)) continue;
		await database.transaction(async tx => {
			await tx.query(migration.sql);
			await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version]);
		});
	}
}
