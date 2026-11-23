import {Module} from '@nestjs/common';
import {StudentClassroomController} from './presentation/student-classroom.controller.js';
import {StudentClassroomUseCases} from './application/student-classroom-read.js';
import {PrismaStudentClassroomRead} from './infrastructure/prisma-student-classroom-read.js';
import {PrismaMembershipAdapter} from '../academics/infrastructure/prisma-subject-repository.js';
import {MaterialUseCases} from './application/material-use-cases.js';
import {PrismaMaterialRepository} from './infrastructure/prisma-material-repository.js';
import {MaterialsController} from './presentation/materials.controller.js';

@Module({
  controllers:[MaterialsController,StudentClassroomController],
  providers:[{
    provide:StudentClassroomUseCases,
    useFactory:()=>new StudentClassroomUseCases(new PrismaStudentClassroomRead(),new PrismaMembershipAdapter()),
  },{
    provide:MaterialUseCases,
    useFactory:()=>new MaterialUseCases(new PrismaMaterialRepository(),new PrismaMembershipAdapter()),
  }],
})
export class ClassroomModule {}
