import { Controller, Get } from '@nestjs/common';

export interface Health {
	status: 'ok';
}

/** Answers once the application has started, so a load balancer or a deploy can wait for it. */
@Controller('health')
export class HealthController {
	@Get()
	check(): Health {
		return { status: 'ok' };
	}
}
