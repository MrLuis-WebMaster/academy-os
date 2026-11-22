import { Module } from '@nestjs/common';
import { SubjectUseCases } from './application/subject-use-cases.js';
import { PrismaMembershipAdapter, PrismaSubjectRepository } from './infrastructure/prisma-subject-repository.js';
import { SubjectsController } from './presentation/subjects.controller.js';
import {CoursesController} from './presentation/courses.controller.js';
import {CourseUseCases} from './application/course-use-cases.js';
import {PrismaCourseRepository} from './infrastructure/prisma-course-repository.js';

/**
 * Composition root: application relies on ports; adapters are replaceable.
 * Other academic aggregates migrate here incrementally.
 */
@Module({
  controllers: [SubjectsController, CoursesController],
  providers: [{
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
