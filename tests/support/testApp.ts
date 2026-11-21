import type { INestApplication } from '@nestjs/common';
import { createApp } from '../../src/app.ts';
import { createUserWithKey } from '../../src/auth/apiKeys.ts';
import type { Database } from '../../src/database/database.ts';
import { createPgliteDatabase } from './pgliteDatabase.ts';

/** The application the server runs, on a port of its own, over an empty PGlite database. */
export interface TestApp {
	app: INestApplication;
	database: Database;
	url: string;
	/** Creates a user and returns the headers its requests carry. */
	user(name?: string): Promise<{ userId: string; headers: Record<string, string> }>;
	close(): Promise<void>;
}

/** Starts the application; `wrap` lets a test change how it sees the database. */
export async function startTestApp(
	wrap: (database: Database) => Database = database => database,
): Promise<TestApp> {
	const database = createPgliteDatabase();
	const app = await createApp({ database: wrap(database) });
	await app.listen(0, '127.0.0.1');
	return {
		app,
		database,
		url: await app.getUrl(),
		async user(name) {
			const { userId, key } = await createUserWithKey(database, name);
			return {
				userId,
				headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
			};
		},
		async close() {
			await app.close();
			await database.close();
		},
	};
}
