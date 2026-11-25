import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	SetMetadata,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DATABASE, type Database } from '../database/database.ts';
import { findUserByKey } from './apiKeys.ts';

const PUBLIC = 'public';

/** Marks a route that answers without a key, such as the health check. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC, true);

/** The request as the guard leaves it: with the id of the user whose key it carried. */
export interface AuthenticatedRequest {
	headers: Record<string, string | string[] | undefined>;
	userId?: string;
}

/**
 * Every request carries `Authorization: Bearer <key>`. A key that is unknown or disabled, or no
 * key, is rejected the same way, so a request learns nothing about which keys exist.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		@Inject(DATABASE) private readonly db: Database,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic === true) return true;

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const header = request.headers.authorization;
		const match = typeof header === 'string' ? /^Bearer (\S+)$/.exec(header) : null;
		const userId = match?.[1] === undefined ? undefined : await findUserByKey(this.db, match[1]);
		if (userId === undefined) throw new UnauthorizedException();
		request.userId = userId;
		return true;
	}
}
