import {Module} from '@nestjs/common';
import {ClassPackagesController} from './presentation/packages.controller.js';
import {ClassPackagesUseCases} from './application/package-use-cases.js';
import {PrismaClassPackagesRepository} from './infrastructure/prisma-class-packages-repository.js';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {StudioUseCases} from './application/studio-use-cases.js';
import {PrismaStudioRepository} from './infrastructure/prisma-studio-repository.js';
import {StudioController} from './presentation/studio.controller.js';

@Module({
  controllers:[StudioController,ClassPackagesController],
  providers:[{
    provide:ClassPackagesUseCases,
    useFactory:()=>new ClassPackagesUseCases(new PrismaClassPackagesRepository(),new PrismaMembershipAdapter()),
  },{
    provide:StudioUseCases,
    useFactory:()=>new StudioUseCases(new PrismaStudioRepository(),new PrismaMembershipAdapter()),
  }],
})
export class CommerceModule {}
