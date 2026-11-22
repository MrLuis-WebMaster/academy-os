import {Module} from '@nestjs/common';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {MaterialUseCases} from './application/material-use-cases.js';
import {PrismaMaterialRepository} from './infrastructure/prisma-material-repository.js';
import {MaterialsController} from './presentation/materials.controller.js';

@Module({
  controllers:[MaterialsController],
  providers:[{
    provide:MaterialUseCases,
    useFactory:()=>new MaterialUseCases(new PrismaMaterialRepository(),new PrismaMembershipAdapter()),
  }],
})
export class ClassroomModule {}
