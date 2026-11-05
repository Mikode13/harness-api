import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.ts';

describe('GET /health', () => {
	let app: INestApplication;

	beforeEach(async () => {
		app = await createApp();
		await app.listen(0, '127.0.0.1');
	});

	afterEach(async () => {
		await app.close();
	});

	it('answers ok once the application has started', async () => {
		const response = await fetch(`${await app.getUrl()}/health`);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ status: 'ok' });
	});

	it('answers 404 for a path it does not serve', async () => {
		const response = await fetch(`${await app.getUrl()}/nothing`);

		expect(response.status).toBe(404);
	});
});
