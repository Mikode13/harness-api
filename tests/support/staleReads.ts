import type { Database, Queryable } from '../../src/database/database.ts';

/**
 * A database whose transactions can be made to miss rows: once armed with patterns, the first
 * query inside a transaction that matches each pattern returns no rows, once. It stands for a copy
 * of a request that read before another copy committed, which PGlite cannot produce, since it
 * runs one transaction at a time.
 */
export interface StaleReads {
	database: Database;
	arm(patterns: readonly RegExp[]): void;
}

export function withStaleReads(database: Database): StaleReads {
	const pending: RegExp[] = [];
	const stale = (on: Queryable): Queryable => ({
		query: async (sql, params) => {
			const index = pending.findIndex(pattern => pattern.test(sql));
			if (index !== -1) {
				pending.splice(index, 1);
				return { rows: [] };
			}
			return on.query(sql, params);
		},
	});
	return {
		database: {
			query: (sql, params) => database.query(sql, params),
			transaction: work => database.transaction(tx => work(stale(tx))),
			close: () => database.close(),
		},
		arm(patterns) {
			pending.push(...patterns);
		},
	};
}
