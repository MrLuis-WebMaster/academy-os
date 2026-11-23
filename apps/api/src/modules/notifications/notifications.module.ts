import {Module} from '@nestjs/common';
import {ReminderPreferencesController} from './presentation/reminder-preferences.controller.js';
import {ReminderPreferencesUseCases} from './application/reminder-use-cases.js';
import {PrismaReminderPreferences} from './infrastructure/prisma-reminder-preferences.js';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {NotificationUseCases} from './application/notification-use-cases.js';
import {PrismaNotificationMailbox} from './infrastructure/prisma-notification-mailbox.js';
import {NotificationsController} from './presentation/notifications.controller.js';

@Module({
 controllers:[NotificationsController,ReminderPreferencesController],
 providers:[{
  provide:ReminderPreferencesUseCases,
  useFactory:()=>new ReminderPreferencesUseCases(new PrismaReminderPreferences(),new PrismaMembershipAdapter()),
 },{
  provide:NotificationUseCases,
  useFactory:()=>new NotificationUseCases(new PrismaNotificationMailbox(),new PrismaMembershipAdapter()),
 }],
})
export class NotificationsModule {}
