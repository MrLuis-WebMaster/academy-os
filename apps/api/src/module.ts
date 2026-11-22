import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DemoController } from './controllers/demo.controller.js';
import { MeController } from './controllers/me.controller.js';
import { WorkspaceController } from './workspaces/controller.js';
import { SessionGuard } from './auth/session.guard.js';
import { CatalogController } from './workspaces/catalog.controller.js';
import { SchedulingController } from './scheduling/controller.js';
import { InvitationsController } from './workspaces/invitations.controller.js';
import { MaterialsController } from './workspaces/materials.controller.js';
import { ClassAliveController } from './learning/class-alive.controller.js';
import { PracticeController } from './learning/practice.controller.js';
import { StudioController } from './studio/controller.js';
import { BookingsController } from './scheduling/bookings.controller.js';
import { FinanceController } from './finance/controller.js';

@Module({
  controllers: [DemoController, MeController, WorkspaceController, CatalogController, SchedulingController, InvitationsController, MaterialsController, ClassAliveController, PracticeController, StudioController, BookingsController, FinanceController],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }],
})
export class AppModule {}
