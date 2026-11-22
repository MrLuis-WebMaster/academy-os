import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DemoController } from './controllers/demo.controller.js';
import { MeController } from './controllers/me.controller.js';
import { WorkspaceController } from './workspaces/controller.js';
import { SessionGuard } from './auth/session.guard.js';
import { CatalogController } from './workspaces/catalog.controller.js';
import { SchedulingController } from './scheduling/controller.js';
import { InvitationsController } from './workspaces/invitations.controller.js';

@Module({
  controllers: [DemoController, MeController, WorkspaceController, CatalogController, SchedulingController, InvitationsController],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }],
})
export class AppModule {}
