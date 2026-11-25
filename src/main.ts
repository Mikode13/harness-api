import { createApp } from './app.ts';
import { createPostgresDatabase } from './database/postgresDatabase.ts';

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
	throw new Error('DATABASE_URL is not set: the API needs its PostgreSQL database.');
}

const database = createPostgresDatabase(databaseUrl);
const app = await createApp({ database });
await app.listen(port);
