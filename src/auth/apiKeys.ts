import { createHash, randomBytes } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import type { Queryable } from '../database/database.ts';

/**
 * A key is long and random, so a fast hash is enough to keep it out of the database: there is
 * nothing to guess that a slow hash would protect.
 */
export function hashKey(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

/** Creates a user and its key. The key is returned once and only its hash is kept. */
export async function createUserWithKey(
	db: Queryable,
	name?: string,
): Promise<{ userId: string; key: string }> {
	const userId = uuidv7();
	const key = `mk_${randomBytes(32).toString('base64url')}`;
	await db.query('INSERT INTO users (id, name) VALUES ($1, $2)', [userId, name ?? null]);
	await db.query('INSERT INTO api_keys (id, user_id, key_hash) VALUES ($1, $2, $3)', [
		uuidv7(),
		userId,
		hashKey(key),
	]);
	return { userId, key };
}

/** The user whose key it is, or undefined when the key is unknown or disabled. */
export async function findUserByKey(db: Queryable, key: string): Promise<string | undefined> {
	const { rows } = await db.query<{ user_id: string }>(
		'SELECT user_id FROM api_keys WHERE key_hash = $1 AND disabled_at IS NULL',
		[hashKey(key)],
	);
	return rows[0]?.user_id;
}
