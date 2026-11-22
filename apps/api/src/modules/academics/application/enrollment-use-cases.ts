import {enrollmentCommand} from '../domain/enrollment.js';
import type {MembershipPort} from './ports.js';
import type {EnrollmentRepository} from './enrollment-ports.js';
import {SubjectAccessDenied} from './subject-use-cases.js';

export class InvalidEnrollmentScope extends Error {
  constructor() { super('Student and course must belong to this academy'); this.name='InvalidEnrollmentScope'; }
}
export class EnrollmentExists extends Error {
  constructor() { super('Student is already enrolled'); this.name='EnrollmentExists'; }
}
export class EnrollmentNotFound extends Error {
  constructor() { super('Enrollment does not exist in this academy'); this.name='EnrollmentNotFound'; }
}

export class EnrollmentUseCases {
  constructor(private readonly repository:EnrollmentRepository, private readonly members:MembershipPort) {}
  private async authorize(workspaceId:string,actorId:string) {
    if (!workspaceId || !actorId || !await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN'])) {
      throw new SubjectAccessDenied();
    }
  }
  private async requireScope(workspaceId:string,courseId:string,studentUserId:string) {
    const [course,student]=await Promise.all([
      this.repository.courseExists(workspaceId,courseId),
      this.repository.studentIsMember(workspaceId,studentUserId),
    ]);
    if (!course || !student) throw new InvalidEnrollmentScope();
  }
  async enroll(workspaceId:string,actorId:string,raw:unknown) {
    await this.authorize(workspaceId,actorId);
    const {courseId,studentUserId}=enrollmentCommand(raw);
    await this.requireScope(workspaceId,courseId,studentUserId);
    return this.repository.add(workspaceId,courseId,studentUserId);
  }
  async unenroll(workspaceId:string,actorId:string,raw:unknown) {
    await this.authorize(workspaceId,actorId);
    const {courseId,studentUserId}=enrollmentCommand(raw);
    await this.requireScope(workspaceId,courseId,studentUserId);
    if (!await this.repository.remove(workspaceId,courseId,studentUserId)) throw new EnrollmentNotFound();
    return {courseId,userId:studentUserId,removed:true};
  }
}
