import { v4 as uuidv4, v7 as uuidv7 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type StaleReads, withStaleReads } from '../support/staleReads.ts';
import { startTestApp, type TestApp } from '../support/testApp.ts';

describe('sessions and prompts', () => {
	let test: TestApp;
	let headers: Record<string, string>;
	let userId: string;

	beforeEach(async () => {
		test = await startTestApp();
		({ headers, userId } = await test.user('maintainer'));
	});

	afterEach(async () => {
		await test.close();
	});

	function prompt(
		sessionId: string,
		body: Record<string, unknown>,
		as = headers,
	): Promise<Response> {
		return fetch(`${test.url}/sessions/${sessionId}/prompts`, {
			method: 'POST',
			headers: as,
			body: JSON.stringify(body),
		});
	}

	describe('authentication', () => {
		it('rejects a request without a key, with an unknown key and with a disabled key', async () => {
			const none = await fetch(`${test.url}/sessions`);
			const unknown = await fetch(`${test.url}/sessions`, {
				headers: { authorization: 'Bearer mk_nope' },
			});
			await test.database.query('UPDATE api_keys SET disabled_at = now() WHERE user_id = $1', [
				userId,
			]);
			const disabled = await fetch(`${test.url}/sessions`, { headers });

			expect([none.status, unknown.status, disabled.status]).toEqual([401, 401, 401]);
		});
	});

	describe('the first prompt creates the session', () => {
		it('creates the session with a default title, a conversation, a run and the user message', async () => {
			const sessionId = uuidv7();
			const promptId = uuidv7();

			const response = await prompt(sessionId, {
				promptId,
				text: 'Fix the login bug',
				workspace: 'none',
			});

			expect(response.status).toBe(201);
			const accepted = (await response.json()) as {
				sessionId: string;
				conversationId: string;
				runId: string;
			};
			expect(accepted.sessionId).toBe(sessionId);

			const sessions = (await (await fetch(`${test.url}/sessions`, { headers })).json()) as {
				id: string;
				title: string;
			}[];
			expect(sessions.map(({ id, title }) => ({ id, title }))).toEqual([
				{ id: sessionId, title: 'Fix the login bug' },
			]);

			const { rows } = await test.database.query<{ state: string }>(
				'SELECT state FROM runs WHERE id = $1',
				[accepted.runId],
			);
			expect(rows).toEqual([{ state: 'setting_up' }]);

			const events = (await (
				await fetch(`${test.url}/sessions/${sessionId}/events?after=0`, { headers })
			).json()) as {
				conversationId: string;
				events: {
					number: number;
					type: string;
					runId: string | null;
					authorUserId: string;
					payload: unknown;
				}[];
			};
			expect(events.conversationId).toBe(accepted.conversationId);
			expect(events.events).toMatchObject([
				{
					number: 1,
					type: 'user_message',
					runId: null,
					authorUserId: userId,
					payload: { promptId, text: 'Fix the login bug' },
				},
			]);
		});

		it('cuts a long first prompt short for the title', async () => {
			const sessionId = uuidv7();
			await prompt(sessionId, { promptId: uuidv7(), text: 'word '.repeat(40), workspace: 'none' });

			const [session] = (await (await fetch(`${test.url}/sessions`, { headers })).json()) as {
				title: string;
			}[];
			expect(session?.title.length).toBeLessThanOrEqual(60);
			expect(session?.title.endsWith('…')).toBe(true);
		});

		it('rejects a first prompt that says neither its projects nor "none"', async () => {
			const response = await prompt(uuidv7(), { promptId: uuidv7(), text: 'Hello' });

			expect(response.status).toBe(422);
		});
	});

	describe('a prompt sent again', () => {
		it('answers with the run of the first time, even while that run is active', async () => {
			const sessionId = uuidv7();
			const body = { promptId: uuidv7(), text: 'Hello', workspace: 'none' };
			const first = (await (await prompt(sessionId, body)).json()) as { runId: string };

			const again = await prompt(sessionId, body);

			expect(again.status).toBe(200);
			await expect(again.json()).resolves.toMatchObject({ runId: first.runId });
			const { rows } = await test.database.query('SELECT 1 FROM events');
			expect(rows).toHaveLength(1);
		});
	});

	describe('a busy conversation', () => {
		it('rejects a new prompt while a run of the conversation is not ended', async () => {
			const sessionId = uuidv7();
			await prompt(sessionId, { promptId: uuidv7(), text: 'First', workspace: 'none' });

			const second = await prompt(sessionId, { promptId: uuidv7(), text: 'Second' });

			expect(second.status).toBe(409);
		});

		it('takes the next prompt once the run ended, numbering its message after the first', async () => {
			const sessionId = uuidv7();
			const first = (await (
				await prompt(sessionId, { promptId: uuidv7(), text: 'First', workspace: 'none' })
			).json()) as {
				runId: string;
			};
			await test.database.query(
				"UPDATE runs SET state = 'completed', ended_at = now() WHERE id = $1",
				[first.runId],
			);

			const second = await prompt(sessionId, { promptId: uuidv7(), text: 'Second' });

			expect(second.status).toBe(201);
			const after = (await (
				await fetch(`${test.url}/sessions/${sessionId}/events?after=1`, { headers })
			).json()) as {
				events: { number: number; payload: { text: string } }[];
			};
			expect(after.events.map(({ number, payload }) => [number, payload.text])).toEqual([
				[2, 'Second'],
			]);
		});
	});

	describe('a deleted session', () => {
		it('rejects a prompt to it, and neither brings it back nor creates another', async () => {
			const sessionId = uuidv7();
			await prompt(sessionId, { promptId: uuidv7(), text: 'First', workspace: 'none' });
			await test.database.query('UPDATE sessions SET deleted_at = now() WHERE id = $1', [
				sessionId,
			]);

			const response = await prompt(sessionId, {
				promptId: uuidv7(),
				text: 'Again',
				workspace: 'none',
			});

			expect(response.status).toBe(410);
			const sessions = (await (
				await fetch(`${test.url}/sessions`, { headers })
			).json()) as unknown[];
			expect(sessions).toEqual([]);
		});
	});

	describe('users are kept apart', () => {
		it('treats the same session id from two users as two sessions, each seeing only its own', async () => {
			const other = await test.user('friend');
			const sessionId = uuidv7();
			await prompt(sessionId, { promptId: uuidv7(), text: 'Mine', workspace: 'none' });

			const theirs = await prompt(
				sessionId,
				{ promptId: uuidv7(), text: 'Theirs', workspace: 'none' },
				other.headers,
			);

			expect(theirs.status).toBe(201);
			const mine = (await (await fetch(`${test.url}/sessions`, { headers })).json()) as {
				title: string;
			}[];
			const seen = (await (
				await fetch(`${test.url}/sessions`, { headers: other.headers })
			).json()) as { title: string }[];
			expect(mine.map(session => session.title)).toEqual(['Mine']);
			expect(seen.map(session => session.title)).toEqual(['Theirs']);
		});

		it('answers 404 for the events of a session the user does not have', async () => {
			const other = await test.user('friend');
			const sessionId = uuidv7();
			await prompt(sessionId, { promptId: uuidv7(), text: 'Mine', workspace: 'none' });

			const response = await fetch(`${test.url}/sessions/${sessionId}/events`, {
				headers: other.headers,
			});

			expect(response.status).toBe(404);
		});
	});

	describe('ids', () => {
		it('rejects a session or prompt id that is not a UUID of version 7', async () => {
			const badSession = await prompt(uuidv4(), {
				promptId: uuidv7(),
				text: 'Hi',
				workspace: 'none',
			});
			const badPrompt = await prompt(uuidv7(), {
				promptId: 'not-an-id',
				text: 'Hi',
				workspace: 'none',
			});

			expect([badSession.status, badPrompt.status]).toEqual([400, 400]);
		});
	});
});

describe('a copy of a prompt that read before another copy committed', () => {
	const lookupPrompt = /FROM runs r JOIN conversations/;
	const lookupSession = /SELECT deleted_at FROM sessions/;
	let test: TestApp;
	let stale: StaleReads;
	let headers: Record<string, string>;

	beforeEach(async () => {
		test = await startTestApp(database => {
			stale = withStaleReads(database);
			return stale.database;
		});
		({ headers } = await test.user());
	});

	afterEach(async () => {
		await test.close();
	});

	function send(sessionId: string, body: Record<string, unknown>): Promise<Response> {
		return fetch(`${test.url}/sessions/${sessionId}/prompts`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		});
	}

	it('finds the run once the conversation is locked, instead of finding it busy', async () => {
		const sessionId = uuidv7();
		const body = { promptId: uuidv7(), text: 'Hello', workspace: 'none' };
		const first = (await (await send(sessionId, body)).json()) as { runId: string };

		stale.arm([lookupPrompt]);
		const second = await send(sessionId, body);

		expect(second.status).toBe(200);
		await expect(second.json()).resolves.toMatchObject({ runId: first.runId });
	});

	it('tries again when the other copy created the session it was about to create', async () => {
		const sessionId = uuidv7();
		const body = { promptId: uuidv7(), text: 'Hello', workspace: 'none' };
		const first = (await (await send(sessionId, body)).json()) as { runId: string };

		stale.arm([lookupPrompt, lookupSession]);
		const second = await send(sessionId, body);

		expect(second.status).toBe(200);
		await expect(second.json()).resolves.toMatchObject({ runId: first.runId });
		const { rows } = await test.database.query('SELECT 1 FROM sessions');
		expect(rows).toHaveLength(1);
	});
});
