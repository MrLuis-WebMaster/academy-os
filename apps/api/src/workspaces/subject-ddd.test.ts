import test from 'node:test';
import assert from 'node:assert/strict';
import { SubjectName, InvalidSubjectName } from '../modules/academics/domain/subject-name.js';
import { SubjectUseCases, SubjectAccessDenied } from '../modules/academics/application/subject-use-cases.js';
import type { MembershipPort, SubjectRecord, SubjectRepository, WorkspaceRole } from '../modules/academics/application/ports.js';

function harness(allow: boolean) {
  const rows: SubjectRecord[] = [];
  const memberships: MembershipPort = {
    async hasAnyRole(_workspace: string, _user: string, _roles: readonly WorkspaceRole[]) { return allow; },
  };
  const subjects: SubjectRepository = {
    async listByWorkspace(workspaceId) { return rows.filter(r => r.workspaceId === workspaceId); },
    async create(input) {
      const result = { id: String(rows.length + 1), ...input };
      rows.push(result);
      return result;
    },
  };
  return { useCases: new SubjectUseCases(subjects, memberships), rows };
}

test('domain subject value object normalizes name and slug', () => {
  const name = SubjectName.create('  Matemáticas   Aplicadas  ');
  assert.equal(name.value, 'Matemáticas Aplicadas');
  assert.equal(name.slug, 'matematicas-aplicadas');
  assert.throws(() => SubjectName.create(' A '), InvalidSubjectName);
  assert.throws(() => SubjectName.create('<>'), InvalidSubjectName);
});

test('a valid member creates and lists only within their workspace', async () => {
  const { useCases } = harness(true);
  const subject = await useCases.create('w1', 'user-1', 'Física');
  assert.equal(subject.slug, 'fisica');
  assert.equal((await useCases.list('w1', 'user-1')).length, 1);
  assert.equal((await useCases.list('w2', 'user-1')).length, 0);
});

test('unauthorized user cannot read or write through the application port', async () => {
  const { useCases, rows } = harness(false);
  await assert.rejects(() => useCases.create('w1','user-1','Música'), SubjectAccessDenied);
  await assert.rejects(() => useCases.list('w1','user-1'), SubjectAccessDenied);
  assert.equal(rows.length,0);
});
