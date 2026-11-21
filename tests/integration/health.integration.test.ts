import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../support/testApp.ts';

describe('GET /health', () => {
	let test: TestApp;

	beforeEach(async () => {
		test = await startTestApp();
	});

	afterEach(async () => {
		await test.close();
	});

	it('answers ok once the application has started, without a key', async () => {
		const response = await fetch(`${test.url}/health`);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ status: 'ok' });
	});

	it('answers 404 for a path it does not serve', async () => {
		const response = await fetch(`${test.url}/nothing`);

		expect(response.status).toBe(404);
	});
});
