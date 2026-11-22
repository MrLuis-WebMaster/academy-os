import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {FinanceUseCases} from './application/finance-use-cases.js';
import {PrismaFinanceRepository} from './infrastructure/prisma-finance-repository.js';
import {FinanceController} from './presentation/finance.controller.js';

@Module({
  controllers:[FinanceController],
  providers:[{
    provide:FinanceUseCases,
    useFactory:()=>new FinanceUseCases(new PrismaFinanceRepository(),new PrismaMembershipAdapter()),
  }],
})
export class FinanceModule {}
