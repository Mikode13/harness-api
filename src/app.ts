import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './appModule.ts';
import type { Database } from './database/database.ts';
import { migrate } from './database/migrations.ts';

export interface AppOptions {
	/** The database the application uses. It is migrated before the application is built. */
	database: Database;
}

/** Builds the application without listening, so tests start it on a port of their own. */
export async function createApp({ database }: AppOptions): Promise<INestApplication> {
	await migrate(database);
	const app = await NestFactory.create(AppModule.withDatabase(database), {
		logger: ['error', 'warn'],
	});
	app.enableShutdownHooks();
	return app;
}
