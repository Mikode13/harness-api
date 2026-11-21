import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './auth/apiKeyGuard.ts';
import { DATABASE, type Database } from './database/database.ts';
import { HealthController } from './health/healthController.ts';
import { SessionsController } from './sessions/sessionsController.ts';
import { SessionsService } from './sessions/sessionsService.ts';

/** The root module, built with the database the application uses. */
@Module({})
export class AppModule {
	static withDatabase(database: Database): DynamicModule {
		return {
			module: AppModule,
			controllers: [HealthController, SessionsController],
			providers: [
				{ provide: DATABASE, useValue: database },
				SessionsService,
				{ provide: APP_GUARD, useClass: ApiKeyGuard },
			],
		};
	}
}
