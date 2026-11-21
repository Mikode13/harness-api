import { Logger } from '@nestjs/common';
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
	// An idle connection that drops emits `error` on the pool, which would end the process with no
	// listener. The pool discards that client and opens another for the next query; a request
	// that needs the database while it is down fails on its own.
	const logger = new Logger('Database');
	pool.on('error', error => {
		logger.error(`An idle database connection failed: ${error.message}`);
	});

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
