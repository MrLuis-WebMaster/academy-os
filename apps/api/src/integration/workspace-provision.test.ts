import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {WorkspaceProvisionUseCases} from '../modules/tenancy/application/workspace-provision-use-cases.js';
import {PrismaWorkspaceProvisionRepository} from '../modules/tenancy/infrastructure/prisma-workspace-provision-repository.js';
import {WorkspaceController} from '../modules/tenancy/presentation/workspaces.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string}):AuthenticatedRequest{
  return {academyUser:{id:user.id,email:user.email,name:'Test'}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL onboarding: OWNER creation is idempotent and private by default',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,14);
  const [owner,other]=await Promise.all([
    prisma.user.create({data:{email:'provision-a-'+nonce+'@example.invalid',name:'Owner'}}),
    prisma.user.create({data:{email:'provision-b-'+nonce+'@example.invalid',name:'Other'}}),
  ]);
  const ids:string[]=[];
  try{
    const api=new WorkspaceController(new WorkspaceProvisionUseCases(new PrismaWorkspaceProvisionRepository()));
    const input={
      requestId:randomUUID(),name:'Academia Integra '+nonce,slug:'provision-'+nonce,
      type:'ACADEMY',timezone:'America/Bogota',
      subjects:['Física','Fisica','Inglés'],
    };
    await assert.rejects(()=>api.create(req(owner),{
      ...input,requestId:'not-a-uuid',
    }),BadRequestException);
    assert.equal((await api.list(req(other))).length,0);
    const results=await Promise.all([
      api.create(req(owner),input),
      api.create(req(owner),input),
    ]);
    assert.equal(results[0]?.id,results[1]?.id);
    assert.equal(results[0]?.role,'OWNER');
    ids.push(results[0]!.id);
    const replay=await api.create(req(owner),input);
    assert.equal(replay.id,results[0]?.id);
    assert.equal(await prisma.workspace.count({where:{slug:input.slug}}),1);
    assert.equal(await prisma.setupRequest.count({where:{userId:owner.id}}),1);
    const workspace=await prisma.workspace.findUniqueOrThrow({
      where:{id:results[0]!.id},
      select:{publicEnabled:true,subjects:{select:{slug:true}},teachers:{select:{userId:true}}},
    });
    assert.equal(workspace.publicEnabled,false);
    assert.equal(workspace.subjects.length,2);
    assert.equal(workspace.teachers.length,1);
    assert.equal(workspace.teachers[0]?.userId,owner.id);
    const memberships=await prisma.workspaceMember.findMany({
      where:{workspaceId:results[0]!.id},select:{userId:true,role:true},
    });
    assert.deepEqual(memberships,[{userId:owner.id,role:'OWNER'}]);
    assert.equal((await api.list(req(owner))).length,1);
    assert.equal((await api.list(req(other))).length,0);
    await assert.rejects(()=>api.create(req(other),{
      ...input,requestId:randomUUID(),
    }),ConflictException);
    assert.equal((await api.list(req(other))).length,0);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:ids}}});
    await prisma.user.deleteMany({where:{id:{in:[owner.id,other.id]}}});
    await prisma.$disconnect();
  }
});
