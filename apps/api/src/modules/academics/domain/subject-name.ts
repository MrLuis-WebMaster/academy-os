import { slugify } from '../../../shared/domain/slug.js';

export class InvalidSubjectName extends Error {
  constructor(message = 'Subject name must contain 2–75 characters') {
    super(message);
    this.name = 'InvalidSubjectName';
  }
}

/** Value object. No persistence, HTTP or framework imports in the domain. */
export class SubjectName {
  private constructor(
    public readonly value: string,
    public readonly slug: string,
  ) {}

  static create(raw: unknown): SubjectName {
    if (typeof raw !== 'string') throw new InvalidSubjectName();
    const value = raw.trim().replace(/\s+/g, ' ');
    const slug = slugify(value);
    if (value.length < 2 || value.length > 75 || slug.length < 2) {
      throw new InvalidSubjectName();
    }
    return new SubjectName(value, slug);
  }
}
