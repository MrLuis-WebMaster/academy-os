/** Enrollment identity is a cross-aggregate reference; no transport/library dependencies. */
export class InvalidEnrollment extends Error {
  constructor(message = 'Both course and student identifiers are required') {
    super(message);
    this.name = 'InvalidEnrollment';
  }
}
export interface EnrollmentCommand { courseId: string; studentUserId: string }
export function enrollmentCommand(input: unknown): EnrollmentCommand {
  if (!input || typeof input !== 'object') throw new InvalidEnrollment();
  const record = input as Record<string,unknown>;
  const courseId = typeof record.courseId === 'string' ? record.courseId.trim() : '';
  const studentUserId = typeof record.studentUserId === 'string' ? record.studentUserId.trim() : '';
  if (!courseId || !studentUserId || courseId.length > 128 || studentUserId.length > 128) {
    throw new InvalidEnrollment();
  }
  return {courseId,studentUserId};
}
