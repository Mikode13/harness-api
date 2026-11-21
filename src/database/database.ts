/** Something SQL can be sent to: the database itself, or a transaction on it. */
export interface Queryable {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- The caller states the shape of the rows it selects; the database cannot know it.
	query<Row>(sql: string, params?: readonly unknown[]): Promise<{ rows: Row[] }>;
}

/**
 * The API's database. Production uses PostgreSQL through `pg`; the tests use PGlite, the same
 * PostgreSQL built into the process, so they need no server and stay offline.
 */
export interface Database extends Queryable {
	/** Runs `work` in one transaction: it commits when `work` resolves and rolls back when it throws. */
	transaction<Result>(work: (tx: Queryable) => Promise<Result>): Promise<Result>;
	close(): Promise<void>;
}

/** The injection token of the {@link Database}. */
export const DATABASE = Symbol('Database');

/** Whether `error` is PostgreSQL's unique violation, optionally on the named constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const { code, constraint: name } = error as { code?: unknown; constraint?: unknown };
	return code === '23505' && (constraint === undefined || name === constraint);
}
