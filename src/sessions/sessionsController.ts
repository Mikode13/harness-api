import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Param,
	Post,
	Query,
	Req,
	Res,
} from '@nestjs/common';
import { validate, version } from 'uuid';
import type { AuthenticatedRequest } from '../auth/apiKeyGuard.ts';
import {
	type PromptAccepted,
	type SessionSummary,
	SessionsService,
	type StoredEvent,
} from './sessionsService.ts';

/** Ids a client generates are UUIDs of version 7, whose first part is the time they were made. */
function uuidV7(value: unknown, name: string): string {
	if (typeof value !== 'string' || !validate(value) || version(value) !== 7) {
		throw new BadRequestException(`${name} must be a UUID of version 7.`);
	}
	return value.toLowerCase();
}

function userOf(request: AuthenticatedRequest): string {
	if (request.userId === undefined) throw new Error('A route that needs a user ran without one.');
	return request.userId;
}

interface StatusResponse {
	status(code: number): unknown;
}

@Controller('sessions')
export class SessionsController {
	constructor(private readonly sessions: SessionsService) {}

	@Get()
	list(@Req() request: AuthenticatedRequest): Promise<SessionSummary[]> {
		return this.sessions.list(userOf(request));
	}

	/**
	 * Sends a prompt. The first prompt to a session id creates the session. A prompt whose id was
	 * already accepted answers 200 with the run of the first time; a new one answers 201.
	 */
	@Post(':sessionId/prompts')
	async prompt(
		@Req() request: AuthenticatedRequest,
		@Param('sessionId') sessionId: string,
		@Body() body: unknown,
		@Res({ passthrough: true }) response: StatusResponse,
	): Promise<Omit<PromptAccepted, 'created'>> {
		const { promptId, text, workspace } = (body ?? {}) as Record<string, unknown>;
		if (typeof text !== 'string' || text.trim() === '')
			throw new BadRequestException('text is required.');
		if (workspace !== undefined && workspace !== 'none') {
			throw new BadRequestException('workspace can only be "none" for now.');
		}
		const accepted = await this.sessions.acceptPrompt(userOf(request), {
			sessionId: uuidV7(sessionId, 'sessionId'),
			promptId: uuidV7(promptId, 'promptId'),
			text,
			...(workspace === 'none' ? { workspace } : {}),
		});
		response.status(accepted.created ? 201 : 200);
		return {
			sessionId: accepted.sessionId,
			conversationId: accepted.conversationId,
			runId: accepted.runId,
		};
	}

	/** The events of the session's active conversation after the number given, in order. */
	@Get(':sessionId/events')
	events(
		@Req() request: AuthenticatedRequest,
		@Param('sessionId') sessionId: string,
		@Query('after') after: string | undefined,
	): Promise<{ conversationId: string; events: StoredEvent[] }> {
		const from = after === undefined ? 0 : Number(after);
		if (!Number.isInteger(from) || from < 0)
			throw new BadRequestException('after must be a whole number.');
		return this.sessions.events(userOf(request), uuidV7(sessionId, 'sessionId'), from);
	}
}
