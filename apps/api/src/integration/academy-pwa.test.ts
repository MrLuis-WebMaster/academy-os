import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {NotFoundException} from '@nestjs/common';
import {prisma} from '../lib/prisma.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {StudioUseCases} from '../modules/commerce/application/studio-use-cases.js';
import {PrismaStudioRepository} from '../modules/commerce/infrastructure/prisma-studio-repository.js';
import {StudioController} from '../modules/commerce/presentation/studio.controller.js';

test('PWA identity is exposed only by public academies and differs between tenants',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,12);
 const owner=await prisma.user.create({
  data:{email:'pwa-owner-'+nonce+'@example.invalid',name:'Owner'},
 });
 const workspaces:string[]=[];
 try{
  const a=await prisma.workspace.create({data:{
   slug:'laura-'+nonce,name:'Laura English Academy',
   type:'SOLO',brandColor:'#1877f2',publicEnabled:false,
   members:{create:{userId:owner.id,role:'OWNER'}},
  }});
  workspaces.push(a.id);
  const b=await prisma.workspace.create({data:{
   slug:'music-'+nonce,name:'Academia Musical',
   type:'ACADEMY',brandColor:'#cf2244',publicEnabled:true,
   members:{create:{userId:owner.id,role:'OWNER'}},
  }});
  workspaces.push(b.id);
  const studio=new StudioController(
   new StudioUseCases(new PrismaStudioRepository(),new PrismaMembershipAdapter()),
  );
  await assert.rejects(()=>studio.publicManifest(a.slug),NotFoundException);
  await assert.rejects(()=>studio.publicIcon(a.slug),NotFoundException);
  const music=await studio.publicManifest(b.slug);
  assert.equal(music.name,'Academia Musical');
  assert.equal(music.theme_color,'#cf2244');
  assert.equal(music.start_url,'/academy/'+b.slug+'/');
  assert.ok((await studio.publicIcon(b.slug)).includes('#cf2244'));
  await prisma.workspace.update({where:{id:a.id},data:{publicEnabled:true}});
  const laura=await studio.publicManifest(a.slug);
  assert.notEqual(laura.id,music.id);
  assert.equal(laura.short_name,'Laura English Academy');
  await prisma.workspace.update({where:{id:b.id},data:{publicEnabled:false}});
  await assert.rejects(()=>studio.publicManifest(b.slug),NotFoundException);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:workspaces}}});
  await prisma.user.deleteMany({where:{id:owner.id}});
  await prisma.$disconnect();
 }
});
