import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: 'integration',
					include: ['tests/integration/**/*.integration.test.ts'],
				},
			},
		],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
		},
	},
});
