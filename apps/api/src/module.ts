import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DemoController } from './controllers/demo.controller.js';
import { MeController } from './controllers/me.controller.js';
import { WorkspaceController } from './workspaces/controller.js';
import { SessionGuard } from './auth/session.guard.js';
import { CatalogController } from './workspaces/catalog.controller.js';
import { StudioController } from './studio/controller.js';
import { BookingsController } from './scheduling/bookings.controller.js';
import { CurriculumController } from './workspaces/curriculum.controller.js';
import { AcademicsModule } from './modules/academics/academics.module.js';
import {SchedulingModule} from './modules/scheduling/scheduling.module.js';
import {NotificationsModule} from './modules/notifications/notifications.module.js';
import {CalendarModule} from './modules/calendar/calendar.module.js';
import {LearningModule} from './modules/learning/learning.module.js';
import {FinanceModule} from './modules/finance/finance.module.js';
import {AttendanceModule} from './modules/attendance/attendance.module.js';
import {ClassroomModule} from './modules/classroom/classroom.module.js';
import {TenancyModule} from './modules/tenancy/tenancy.module.js';

@Module({
  imports: [AcademicsModule,SchedulingModule,LearningModule,NotificationsModule,CalendarModule,FinanceModule,AttendanceModule,ClassroomModule,TenancyModule],
  controllers: [DemoController, MeController, WorkspaceController, CatalogController, StudioController, BookingsController, CurriculumController],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }],
})
export class AppModule {}
