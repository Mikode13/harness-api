import pg from 'pg';
import type { Database, Queryable } from './database.ts';

/** Runs `sql`: with no parameters `pg` sends a simple query, which may hold several statements. */
async function run(
	on: pg.Pool | pg.PoolClient,
	sql: string,
	params: readonly unknown[],
): Promise<{ rows: never[] }> {
	const result = params.length === 0 ? await on.query(sql) : await on.query(sql, [...params]);
	return { rows: result.rows as never[] };
}

/** A {@link Database} on a PostgreSQL server, through a pool of connections. */
export function createPostgresDatabase(connectionString: string): Database {
	const pool = new pg.Pool({ connectionString });

	return {
		query: (sql: string, params: readonly unknown[] = []) => run(pool, sql, params),
		async transaction<Result>(work: (tx: Queryable) => Promise<Result>): Promise<Result> {
			const client = await pool.connect();
			try {
				await client.query('BEGIN');
				const result = await work({
					query: (sql: string, params: readonly unknown[] = []) => run(client, sql, params),
				});
				await client.query('COMMIT');
				return result;
			} catch (error) {
				await client.query('ROLLBACK');
				throw error;
			} finally {
				client.release();
			}
		},
		close: () => pool.end(),
	};
}
