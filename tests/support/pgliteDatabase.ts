import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { Database, Queryable } from '../../src/database/database.ts';

/** Runs `sql` on PGlite: as a script when it has no parameters, so it may hold several statements. */
async function run(
	on: PGlite | Transaction,
	sql: string,
	params: readonly unknown[],
): Promise<{ rows: never[] }> {
	if (params.length === 0) {
		const results = await on.exec(sql);
		return { rows: (results.at(-1)?.rows ?? []) as never[] };
	}
	return { rows: (await on.query<never>(sql, [...params])).rows };
}

/** A {@link Database} on PGlite, PostgreSQL in the test's own process, empty and in memory. */
export function createPgliteDatabase(): Database {
	const db = new PGlite();

	return {
		query: (sql: string, params: readonly unknown[] = []) => run(db, sql, params),
		transaction: <Result>(work: (tx: Queryable) => Promise<Result>): Promise<Result> =>
			db.transaction(async transaction =>
				work({
					query: (sql: string, params: readonly unknown[] = []) => run(transaction, sql, params),
				}),
			),
		close: () => db.close(),
	};
}
