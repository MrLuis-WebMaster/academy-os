import {Module} from '@nestjs/common';
import {PrivateMaterialsController} from './presentation/private-materials.controller.js';
import {PrivateMaterialUseCases} from './application/private-material-use-cases.js';
import {PrismaPrivateMaterialRepository} from './infrastructure/prisma-private-material-repository.js';
import {StudentClassroomController} from './presentation/student-classroom.controller.js';
import {StudentClassroomUseCases} from './application/student-classroom-read.js';
import {PrismaStudentClassroomRead} from './infrastructure/prisma-student-classroom-read.js';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {MaterialUseCases} from './application/material-use-cases.js';
import {PrismaMaterialRepository} from './infrastructure/prisma-material-repository.js';
import {MaterialsController} from './presentation/materials.controller.js';

@Module({
  controllers:[MaterialsController,StudentClassroomController,PrivateMaterialsController],
  providers:[{
    provide:PrivateMaterialUseCases,
    useFactory:()=>new PrivateMaterialUseCases(new PrismaPrivateMaterialRepository(),new PrismaMembershipAdapter(),process.env.ACADEMY_PRIVATE_FILES_ENABLED==='true'),
  },{
    provide:StudentClassroomUseCases,
    useFactory:()=>new StudentClassroomUseCases(new PrismaStudentClassroomRead(),new PrismaMembershipAdapter()),
  },{
    provide:MaterialUseCases,
    useFactory:()=>new MaterialUseCases(new PrismaMaterialRepository(),new PrismaMembershipAdapter()),
  }],
})
export class ClassroomModule {}
