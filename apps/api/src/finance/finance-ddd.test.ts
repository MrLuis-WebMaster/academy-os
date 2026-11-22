import test from 'node:test';
import assert from 'node:assert/strict';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';
import type {FinanceRepository,RecordManualReceipt} from '../modules/finance/application/ports.js';
import {
  ActiveReceiptNotFound,CourseOutsideWorkspace,FinanceAccessDenied,
  FinanceUseCases,StudentOutsideWorkspace,
} from '../modules/finance/application/finance-use-cases.js';
import {InvalidReceiptInput} from '../modules/finance/domain/manual-receipt.js';

function fixture(){
  const recorded:RecordManualReceipt[]=[];
  const voided:string[]=[];
  const members:MembershipPort={
    hasAnyRole:async (workspace,user,roles:readonly WorkspaceRole[])=>{
      const role=user==='owner'?'OWNER':user==='admin'?'ADMIN':'STUDENT';
      return workspace==='academy-a'&&roles.includes(role);
    },
  };
  const repo:FinanceRepository={
    listReceipts:async()=>[],
    summarize:async()=>({currency:'COP',totalReceivedCOP:0,receiptCount:0}),
    studentIsMember:async (workspace,user)=>workspace==='academy-a'&&user==='student-a',
    courseBelongsToWorkspace:async (workspace,course)=>workspace==='academy-a'&&course==='course-a',
    record:async input=>{
      recorded.push(input);
      return {id:'receipt-a',amountCOP:input.amountCOP,method:input.method,receivedAt:new Date('2026-11-01T00:00:00Z')};
    },
    voidActive:async (workspace,id,reason)=>{
      if(workspace!=='academy-a'||id!=='receipt-a')return false;
      voided.push(reason);
      return true;
    },
  };
  return {finance:new FinanceUseCases(repo,members),recorded,voided};
}
const valid={studentUserId:'student-a',courseId:'course-a',amountCOP:60000,method:'BANK_TRANSFER',reference:'BANK123'};

test('student or other academy cannot list or record manual receipts',async()=>{
  const {finance,recorded}=fixture();
  await assert.rejects(finance.list('academy-a','student-a'),FinanceAccessDenied);
  await assert.rejects(finance.summary('academy-b','owner'),FinanceAccessDenied);
  await assert.rejects(finance.record('academy-b','owner',valid),FinanceAccessDenied);
  assert.equal(recorded.length,0);
});

test('owners and admins can record only same-workspace students and courses',async()=>{
  const {finance,recorded}=fixture();
  await assert.rejects(finance.record('academy-a','admin',{...valid,studentUserId:'student-b'}),StudentOutsideWorkspace);
  await assert.rejects(finance.record('academy-a','owner',{...valid,courseId:'course-b'}),CourseOutsideWorkspace);
  await assert.rejects(finance.record('academy-a','owner',{...valid,amountCOP:0}),InvalidReceiptInput);
  assert.equal(recorded.length,0);
  const result=await finance.record('academy-a','admin',valid);
  assert.equal(result.amountCOP,60000);
  assert.deepEqual(recorded[0],{
    workspaceId:'academy-a',studentUserId:'student-a',recordedByUserId:'admin',
    courseId:'course-a',amountCOP:60000,method:'BANK_TRANSFER',reference:'BANK123',
  });
});

test('only the owner can void a receipt with a reason; missing receipt remains missing',async()=>{
  const {finance,voided}=fixture();
  await assert.rejects(finance.voidReceipt('academy-a','admin','receipt-a',{reason:'Duplicado'}),FinanceAccessDenied);
  await assert.rejects(finance.voidReceipt('academy-a','owner','receipt-a',{reason:'x'}),InvalidReceiptInput);
  await assert.rejects(finance.voidReceipt('academy-a','owner','receipt-b',{reason:'Duplicado'}),ActiveReceiptNotFound);
  const result=await finance.voidReceipt('academy-a','owner','receipt-a',{reason:'Duplicado'});
  assert.deepEqual(result,{id:'receipt-a',voided:true});
  assert.deepEqual(voided,['Duplicado']);
});
