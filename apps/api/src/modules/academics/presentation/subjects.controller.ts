import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException,
  Get, HttpException, InternalServerErrorException, Param, Post, Req,
} from '@nestjs/common';
import { SubjectUseCases, SubjectAccessDenied, SubjectAlreadyExists } from '../application/subject-use-cases.js';
import { InvalidSubjectName } from '../domain/subject-name.js';
import type { AuthenticatedRequest } from '../../../auth/session.guard.js';

@Controller('workspaces/:workspaceId/subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectUseCases) {}

  private translate(error: unknown): never {
    if (error instanceof SubjectAccessDenied) throw new ForbiddenException(error.message);
    if (error instanceof InvalidSubjectName) throw new BadRequestException(error.message);
    if (error instanceof SubjectAlreadyExists) throw new ConflictException(error.message);
    // Do not disguise unexpected persistence errors as a validation problem.
    if (error instanceof HttpException) throw error;
    throw new InternalServerErrorException('Unable to process subjects');
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string) {
    try {
      return await this.subjects.list(workspaceId, req.academyUser!.id);
    } catch (error) {
      return this.translate(error);
    }
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Param('workspaceId') workspaceId: string, @Body() payload: unknown) {
    const name = typeof payload === 'object' && payload !== null && 'name' in payload ? payload.name : undefined;
    try {
      return await this.subjects.create(workspaceId, req.academyUser!.id, name);
    } catch (error) {
      return this.translate(error);
    }
  }
}
