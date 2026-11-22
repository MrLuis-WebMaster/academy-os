import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {NotificationUseCases} from './application/notification-use-cases.js';
import {PrismaNotificationMailbox} from './infrastructure/prisma-notification-mailbox.js';
import {NotificationsController} from './presentation/notifications.controller.js';

@Module({
 controllers:[NotificationsController],
 providers:[{
  provide:NotificationUseCases,
  useFactory:()=>new NotificationUseCases(new PrismaNotificationMailbox(),new PrismaMembershipAdapter()),
 }],
})
export class NotificationsModule {}
