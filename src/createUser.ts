import { createUserWithKey } from './auth/apiKeys.ts';
import { migrate } from './database/migrations.ts';
import { createPostgresDatabase } from './database/postgresDatabase.ts';

/**
 * Creates a user and prints its API key, once: only its hash is kept. Run on the server by the
 * maintainer, with `DATABASE_URL` set: `pnpm run user:create -- <name>`.
 */
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') throw new Error('DATABASE_URL is not set.');

const database = createPostgresDatabase(databaseUrl);
try {
	await migrate(database);
	const { userId, key } = await createUserWithKey(database, process.argv[2]);
	process.stdout.write(`user ${userId}\nkey ${key}\n`);
} finally {
	await database.close();
}
