import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {StudioUseCases} from './application/studio-use-cases.js';
import {PrismaStudioRepository} from './infrastructure/prisma-studio-repository.js';
import {StudioController} from './presentation/studio.controller.js';

@Module({
  controllers:[StudioController],
  providers:[{
    provide:StudioUseCases,
    useFactory:()=>new StudioUseCases(new PrismaStudioRepository(),new PrismaMembershipAdapter()),
  }],
})
export class CommerceModule {}
