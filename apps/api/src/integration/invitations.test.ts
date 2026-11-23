import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {
  ForbiddenException,GoneException,HttpException,
} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {InvitationUseCases} from '../modules/tenancy/application/invitation-use-cases.js';
import {PrismaInvitationRepository} from '../modules/tenancy/infrastructure/prisma-invitation-repository.js';
import {SecureInvitationToken} from '../modules/tenancy/infrastructure/secure-invitation-token.js';
import {InvitationsController} from '../modules/tenancy/presentation/invitations.controller.js';
import type {AuthenticatedRequest} from '../auth/session.guard.js';

function req(user:{id:string;email:string}):AuthenticatedRequest{
  return {academyUser:{id:user.id,email:user.email,name:'Test'}} as unknown as AuthenticatedRequest;
}
test('PostgreSQL invitations: role isolation, email binding, one-time use and concurrent daily cap',async()=>{
  const nonce=randomUUID().replaceAll('-','').slice(0,15);
  const people=await Promise.all([
    prisma.user.create({data:{email:'invite-owner-'+nonce+'@example.invalid',name:'Owner'}}),
    prisma.user.create({data:{email:'invite-admin-'+nonce+'@example.invalid',name:'Admin'}}),
    prisma.user.create({data:{email:'invite-teacher-'+nonce+'@example.invalid',name:'Teacher'}}),
    prisma.user.create({data:{email:'invite-student-'+nonce+'@example.invalid',name:'Student'}}),
    prisma.user.create({data:{email:'invite-foreign-'+nonce+'@example.invalid',name:'Foreign'}}),
  ]);
  const [owner,admin,teacher,student,foreign]=people;
  const workspaceIds:string[]=[];
  try{
    const academy=await prisma.workspace.create({
      data:{slug:'invite-academy-'+nonce,name:'Invitation A',type:'ACADEMY',
        members:{create:[
          {userId:owner!.id,role:'OWNER'},
          {userId:admin!.id,role:'ADMIN'},
        ]},
      },
    });
    workspaceIds.push(academy.id);
    const other=await prisma.workspace.create({
      data:{slug:'invite-other-'+nonce,name:'Invitation B',type:'ACADEMY',
        members:{create:{userId:foreign!.id,role:'OWNER'}},
      },
    });
    workspaceIds.push(other.id);

    const controller=new InvitationsController(
      new InvitationUseCases(
        new PrismaInvitationRepository(),new PrismaMembershipAdapter(),
        new SecureInvitationToken(),
      ),
    );
    await assert.rejects(()=>controller.invite(req(foreign!),academy.id,{
      email:teacher!.email,role:'TEACHER',
    }),ForbiddenException);
    await assert.rejects(()=>controller.invite(req(admin!),academy.id,{
      email:teacher!.email,role:'ADMIN',
    }),ForbiddenException);
    const teacherInvitation=await controller.invite(req(owner!),academy.id,{
      email:teacher!.email.toUpperCase(),role:'TEACHER',
    });
    assert.equal(teacherInvitation.email,teacher!.email);
    const token=new URL(teacherInvitation.inviteUrl).searchParams.get('invite');
    assert.ok(token);
    assert.equal((await prisma.workspaceInvitation.findFirstOrThrow({
      where:{id:teacherInvitation.id},select:{tokenHash:true},
    })).tokenHash.includes(token!),false);

    await assert.rejects(()=>controller.accept(req(student!),{token}),ForbiddenException);
    const joined=await controller.accept(req(teacher!),{token});
    assert.deepEqual(joined,{workspaceId:academy.id,role:'TEACHER'});
    assert.equal(await prisma.teacherProfile.count({where:{
      workspaceId:academy.id,userId:teacher!.id,
    }}),1);
    await assert.rejects(()=>controller.accept(req(teacher!),{token}),GoneException);
    assert.equal(await prisma.workspaceMember.count({where:{
      workspaceId:academy.id,userId:teacher!.id,role:'TEACHER',
    }}),1);
    assert.equal(await prisma.workspaceMember.count({where:{
      workspaceId:other.id,userId:teacher!.id,
    }}),0);

    const studentInvitation=await controller.invite(req(admin!),academy.id,{
      email:student!.email,role:'STUDENT',
    });
    const studentToken=new URL(studentInvitation.inviteUrl).searchParams.get('invite');
    await controller.accept(req(student!),{token:studentToken});
    assert.equal(await prisma.workspaceMember.count({where:{
      workspaceId:academy.id,userId:student!.id,role:'STUDENT',
    }}),1);
    assert.equal(await prisma.teacherProfile.count({where:{
      workspaceId:academy.id,userId:student!.id,
    }}),0);

    // Insert exactly 97 additional invitations: with two real ones this yields
    // 99 in the last 24 hours. Only one of two concurrent requests can issue.
    await prisma.workspaceInvitation.createMany({data:Array.from({length:97},(_,i)=>({
      workspaceId:academy.id,email:'unused-'+i+'-'+nonce+'@example.invalid',
      role:'STUDENT' as const,tokenHash:randomUUID().replaceAll('-',''),
      createdBy:owner!.id,expiresAt:new Date(Date.now()+86400000),
    }))});
    const concurrent=await Promise.allSettled([
      controller.invite(req(owner!),academy.id,{
        email:'concurrent-one-'+nonce+'@example.invalid',role:'STUDENT',
      }),
      controller.invite(req(admin!),academy.id,{
        email:'concurrent-two-'+nonce+'@example.invalid',role:'STUDENT',
      }),
    ]);
    assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(concurrent.filter(x=>x.status==='rejected').length,1);
    const rejection=concurrent.find(x=>x.status==='rejected');
    assert.ok(rejection&&rejection.status==='rejected');
    assert.ok(rejection.reason instanceof HttpException);
    assert.equal(rejection.reason.getStatus(),429);
    assert.equal(await prisma.workspaceInvitation.count({where:{workspaceId:academy.id}}),100);
    assert.equal(await prisma.workspaceInvitation.count({where:{workspaceId:other.id}}),0);
  }finally{
    await prisma.workspace.deleteMany({where:{id:{in:workspaceIds}}});
    await prisma.user.deleteMany({where:{id:{in:people.map(p=>p.id)}}});
    await prisma.$disconnect();
  }
});
