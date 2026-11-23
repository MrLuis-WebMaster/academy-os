import { Module } from '@nestjs/common';
import {CurriculumController} from './presentation/curriculum.controller.js';
import {CurriculumUseCases} from './application/curriculum-use-cases.js';
import {PrismaCurriculumRepository} from './infrastructure/prisma-curriculum-repository.js';
import { SubjectUseCases } from './application/subject-use-cases.js';
import { PrismaMembershipAdapter, PrismaSubjectRepository } from './infrastructure/prisma-subject-repository.js';
import { SubjectsController } from './presentation/subjects.controller.js';
import {CoursesController} from './presentation/courses.controller.js';
import {CourseUseCases} from './application/course-use-cases.js';
import {PrismaCourseRepository} from './infrastructure/prisma-course-repository.js';
import {EnrollmentUseCases} from './application/enrollment-use-cases.js';
import {PrismaEnrollmentRepository} from './infrastructure/prisma-enrollment-repository.js';
import {EnrollmentsController} from './presentation/enrollments.controller.js';

/**
 * Composition root: application relies on ports; adapters are replaceable.
 * Other academic aggregates migrate here incrementally.
 */
@Module({
  controllers: [SubjectsController, CoursesController, EnrollmentsController, CurriculumController],
  providers: [{
    provide:CurriculumUseCases,
    useFactory:()=>new CurriculumUseCases(new PrismaCurriculumRepository(),new PrismaMembershipAdapter()),
  },{
    provide:EnrollmentUseCases,
    useFactory:()=>new EnrollmentUseCases(new PrismaEnrollmentRepository(),new PrismaMembershipAdapter()),
  },{
    provide: CourseUseCases,
    useFactory: () => new CourseUseCases(new PrismaCourseRepository(),new PrismaMembershipAdapter()),
  },{
    provide: SubjectUseCases,
    useFactory: () => new SubjectUseCases(
      new PrismaSubjectRepository(),
      new PrismaMembershipAdapter(),
    ),
  }],
})
export class AcademicsModule {}
