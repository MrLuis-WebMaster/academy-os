import { Module } from '@nestjs/common';
import { SubjectUseCases } from './application/subject-use-cases.js';
import { PrismaMembershipAdapter, PrismaSubjectRepository } from './infrastructure/prisma-subject-repository.js';
import { SubjectsController } from './presentation/subjects.controller.js';

/**
 * Composition root: application relies on ports; adapters are replaceable.
 * Other academic aggregates migrate here incrementally.
 */
@Module({
  controllers: [SubjectsController],
  providers: [{
    provide: SubjectUseCases,
    useFactory: () => new SubjectUseCases(
      new PrismaSubjectRepository(),
      new PrismaMembershipAdapter(),
    ),
  }],
})
export class AcademicsModule {}
