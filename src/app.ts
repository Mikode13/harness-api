import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './appModule.ts';

/** Builds the application without listening, so tests start it on a port of their own. */
export async function createApp(): Promise<INestApplication> {
	const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
	app.enableShutdownHooks();
	return app;
}
