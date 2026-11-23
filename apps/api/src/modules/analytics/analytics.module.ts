import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {AnalyticsUseCases} from './application/analytics-use-cases.js';
import {PrismaAnalyticsRepository} from './infrastructure/prisma-analytics-repository.js';
import {AnalyticsController} from './presentation/analytics.controller.js';

@Module({
  controllers:[AnalyticsController],
  providers:[{
    provide:AnalyticsUseCases,
    useFactory:()=>new AnalyticsUseCases(new PrismaAnalyticsRepository(),new PrismaMembershipAdapter()),
  }],
})
export class AnalyticsModule {}
