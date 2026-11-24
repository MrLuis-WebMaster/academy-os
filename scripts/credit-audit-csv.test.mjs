import assert from 'node:assert/strict';
import test from 'node:test';
import {serializeCreditAuditCsv,creditAuditFilename} from '../apps/web/src/shared/credit-audit-csv.ts';

const sample={
 id:'grant-123',credits:4,used:1,remaining:3,available:3,futureBookings:1,
 issuedAt:'2026-11-23T10:00:00Z',expiresAt:'2026-12-23T10:00:00Z',
 revokedAt:null,revokeReason:null,
 package:{title:'Cuatro clases',courseId:'course-1',priceCOP:100000},
 student:{name:'María García'},issuer:{name:'Administración'},
};
test('exports UTF-8 BOM and the correct private administrative fields',()=>{
 const csv=serializeCreditAuditCsv([sample]);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.ok(csv.includes('"María García"'));
 assert.ok(csv.includes('"100000"'));
 assert.ok(csv.includes('"2026-11-23T10:00:00.000Z"'));
 assert.ok(csv.endsWith('\r\n'));
 assert.equal(csv.split('\r\n').length,3);
});
test('escapes quoted cells and stops spreadsheet formula injection',()=>{
 const csv=serializeCreditAuditCsv([{
  ...sample,student:{name:' =HYPERLINK("https://evil.test")'},
  issuer:{name:'+SUM(1,2)'},package:{...sample.package,title:'a"b'},
  revokeReason:'@cmd',
 }]);
 assert.ok(csv.includes('"\' =HYPERLINK(""https://evil.test"")"'));
 assert.ok(csv.includes('"\'+SUM(1,2)"'));
 assert.ok(csv.includes('"\'@cmd"'));
 assert.ok(csv.includes('"a""b"'));
});
test('exports empty selection without inventing records',()=>{
 const csv=serializeCreditAuditCsv([]);
 assert.equal(csv.split('\r\n').length,2);
});
test('never interpolates unsafe workspace path characters into the filename',()=>{
 assert.equal(creditAuditFilename('../evil/a',new Date('2026-11-23T12:00:00Z')),
  'academy-os-creditos-evila-2026-11-23.csv');
});
