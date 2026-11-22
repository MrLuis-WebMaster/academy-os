import { Module } from '@nestjs/common';
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
  controllers: [SubjectsController, CoursesController, EnrollmentsController],
  providers: [{
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
