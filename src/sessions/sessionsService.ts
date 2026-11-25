import {
	ConflictException,
	GoneException,
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import {
	DATABASE,
	type Database,
	isUniqueViolation,
	type Queryable,
} from '../database/database.ts';

/** The schema version of the events this API writes itself, such as the user's message. */
export const USER_MESSAGE_SCHEMA_VERSION = 1;

/** How long a default title is: the first prompt's text, cut short. */
const TITLE_LENGTH = 60;

export interface PromptInput {
	sessionId: string;
	promptId: string;
	text: string;
	/** Only "none" for now: projects wait for their registration to be designed. */
	workspace?: 'none';
}

export interface PromptAccepted {
	sessionId: string;
	conversationId: string;
	runId: string;
	/** Whether this is the first time the prompt arrived; false for a prompt sent again. */
	created: boolean;
}

export interface SessionSummary {
	id: string;
	title: string;
	createdAt: string;
}

export interface StoredEvent {
	number: number;
	type: string;
	schemaVersion: number;
	runId: string | null;
	authorUserId: string | null;
	payload: unknown;
	createdAt: string;
}

/**
 * Sessions, their conversations and their events, as the flows
 * [create-session](https://github.com/Mikode13/harness-docs/blob/main/flows/create-session.md)
 * and prompt-and-reconnect describe them. Every query is scoped to its user.
 */
@Injectable()
export class SessionsService {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async acceptPrompt(userId: string, input: PromptInput): Promise<PromptAccepted> {
		// A copy of the prompt that raced another can fail on a constraint the other one took; the
		// second attempt then finds what the first stored, or the session it created.
		for (let attempt = 1; ; attempt += 1) {
			try {
				return await this.db.transaction(async tx => {
					const known = await findPrompt(tx, userId, input.promptId);
					if (known !== undefined) return known;
					return await acceptNewPrompt(tx, userId, input);
				});
			} catch (error) {
				const raced =
					isUniqueViolation(error, 'runs_prompt_once') || isUniqueViolation(error, 'sessions_pkey');
				if (raced && attempt < 2) continue;
				if (isUniqueViolation(error, 'runs_one_active')) throw busy();
				throw error;
			}
		}
	}

	async list(userId: string): Promise<SessionSummary[]> {
		const { rows } = await this.db.query<{ id: string; title: string; created_at: Date }>(
			'SELECT id, title, created_at FROM sessions WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC, id DESC',
			[userId],
		);
		return rows.map(row => ({
			id: row.id,
			title: row.title,
			createdAt: row.created_at.toISOString(),
		}));
	}

	async events(
		userId: string,
		sessionId: string,
		after: number,
	): Promise<{ conversationId: string; events: StoredEvent[] }> {
		const conversationId = await activeConversation(this.db, userId, sessionId);
		const { rows } = await this.db.query<{
			number: string;
			type: string;
			schema_version: number;
			run_id: string | null;
			author_user_id: string | null;
			payload: unknown;
			created_at: Date;
		}>(
			'SELECT number, type, schema_version, run_id, author_user_id, payload, created_at FROM events WHERE conversation_id = $1 AND number > $2 ORDER BY number',
			[conversationId, after],
		);
		return {
			conversationId,
			events: rows.map(row => ({
				number: Number(row.number),
				type: row.type,
				schemaVersion: row.schema_version,
				runId: row.run_id,
				authorUserId: row.author_user_id,
				payload: row.payload,
				createdAt: row.created_at.toISOString(),
			})),
		};
	}
}

function busy(): ConflictException {
	return new ConflictException('A run of this conversation is not ended.');
}

async function findPrompt(
	db: Queryable,
	userId: string,
	promptId: string,
): Promise<PromptAccepted | undefined> {
	const { rows } = await db.query<{ run_id: string; conversation_id: string; session_id: string }>(
		`SELECT r.id AS run_id, r.conversation_id, c.session_id
		 FROM runs r JOIN conversations c ON c.id = r.conversation_id
		 WHERE r.user_id = $1 AND r.prompt_id = $2`,
		[userId, promptId],
	);
	const row = rows[0];
	return row === undefined
		? undefined
		: {
				sessionId: row.session_id,
				conversationId: row.conversation_id,
				runId: row.run_id,
				created: false,
			};
}

async function acceptNewPrompt(
	tx: Queryable,
	userId: string,
	input: PromptInput,
): Promise<PromptAccepted> {
	const { rows: sessions } = await tx.query<{ deleted_at: Date | null }>(
		'SELECT deleted_at FROM sessions WHERE user_id = $1 AND id = $2 FOR UPDATE',
		[userId, input.sessionId],
	);
	const session = sessions[0];
	if (session?.deleted_at != null) throw new GoneException('The session is deleted.');

	if (session === undefined) {
		if (input.workspace !== 'none') {
			throw new UnprocessableEntityException(
				'The first prompt of a session says its projects, and only "none" is supported for now.',
			);
		}
		await tx.query('INSERT INTO sessions (user_id, id, title, workspace) VALUES ($1, $2, $3, $4)', [
			userId,
			input.sessionId,
			defaultTitle(input.text),
			'none',
		]);
		await tx.query('INSERT INTO conversations (id, user_id, session_id) VALUES ($1, $2, $3)', [
			uuidv7(),
			userId,
			input.sessionId,
		]);
	}

	const { rows: conversations } = await tx.query<{ id: string; next_event_number: string }>(
		'SELECT id, next_event_number FROM conversations WHERE user_id = $1 AND session_id = $2 AND archived_at IS NULL FOR UPDATE',
		[userId, input.sessionId],
	);
	const conversation = conversations[0];
	if (conversation === undefined)
		throw new Error(`Session ${input.sessionId} has no active conversation.`);

	// With the conversation locked, a copy of this prompt that was accepted meanwhile is visible:
	// it answers with that run rather than finding the conversation busy with it.
	const accepted = await findPrompt(tx, userId, input.promptId);
	if (accepted !== undefined) return accepted;

	const { rows: active } = await tx.query<{ id: string }>(
		`SELECT id FROM runs WHERE conversation_id = $1
		 AND state IN ('setting_up', 'running', 'waiting_for_input', 'cancelling')`,
		[conversation.id],
	);
	if (active.length > 0) throw busy();

	const runId = uuidv7();
	await tx.query(
		"INSERT INTO runs (id, user_id, conversation_id, prompt_id, state) VALUES ($1, $2, $3, $4, 'setting_up')",
		[runId, userId, conversation.id, input.promptId],
	);
	await tx.query(
		`INSERT INTO events (conversation_id, number, author_user_id, type, schema_version, payload)
		 VALUES ($1, $2, $3, 'user_message', $4, $5)`,
		[
			conversation.id,
			conversation.next_event_number,
			userId,
			USER_MESSAGE_SCHEMA_VERSION,
			JSON.stringify({ promptId: input.promptId, text: input.text }),
		],
	);
	await tx.query(
		'UPDATE conversations SET next_event_number = next_event_number + 1 WHERE id = $1',
		[conversation.id],
	);

	return { sessionId: input.sessionId, conversationId: conversation.id, runId, created: true };
}

async function activeConversation(
	db: Queryable,
	userId: string,
	sessionId: string,
): Promise<string> {
	const { rows } = await db.query<{ id: string }>(
		`SELECT c.id FROM conversations c
		 JOIN sessions s ON s.user_id = c.user_id AND s.id = c.session_id
		 WHERE c.user_id = $1 AND c.session_id = $2 AND c.archived_at IS NULL AND s.deleted_at IS NULL`,
		[userId, sessionId],
	);
	const row = rows[0];
	if (row === undefined) throw new NotFoundException();
	return row.id;
}

function defaultTitle(text: string): string {
	const line = text.trim().replace(/\s+/g, ' ');
	if (line.length <= TITLE_LENGTH) return line === '' ? 'New session' : line;
	return `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…`;
}
