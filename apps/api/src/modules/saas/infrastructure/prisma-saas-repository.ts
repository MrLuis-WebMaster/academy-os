import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {SaasRepository} from '../application/ports.js';
import {SaasDenied,SaasMissing,SaasInvalid,utcDayStart,type PlanCode} from '../domain/plan.js';
import {lockPlan} from './plan-policy.js';
export class PrismaSaasRepository implements SaasRepository{
 constructor(private readonly operatorIds:ReadonlySet<string>){}
 private async operator(tx:Prisma.TransactionClient,userId:string){
  return this.operatorIds.has(userId)&&!!await tx.user.findFirst({where:{id:userId,emailVerified:true},select:{id:true}});
 }
 async isOperator(userId:string){return this.operator(prisma,userId);}
 async summary(w:string,u:string){
  return prisma.$transaction(async tx=>{
   if(!await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:u,role:{in:['OWNER','ADMIN']}},select:{id:true}}))throw new SaasDenied('Academy manager required');
   const [assignment,students,teachers,storage,aiDailyAttempts]=await Promise.all([
    tx.saasSubscription.findUnique({where:{workspaceId:w},select:{plan:true,validUntil:true}}),
    tx.workspaceMember.count({where:{workspaceId:w,role:'STUDENT'}}),
    tx.teacherProfile.count({where:{workspaceId:w}}),
    tx.privateMaterialFile.aggregate({where:{resource:{workspaceId:w}},_sum:{sizeBytes:true}}),
    tx.aiGeneration.count({where:{workspaceId:w,createdAt:{gte:utcDayStart()}}}),
   ]);
   return {assignment,usage:{students,teachers,storageBytes:storage._sum.sizeBytes??0,aiDailyAttempts}};
  });
 }
 async list(u:string,after:string|null){
  return prisma.$transaction(async tx=>{
   if(!await this.operator(tx,u))throw new SaasDenied('Platform operator required');
   const rows=await tx.workspace.findMany({where:after?{id:{gt:after}}:{},orderBy:{id:'asc'},take:50,select:{id:true,name:true,slug:true,saasSubscription:{select:{plan:true,validUntil:true}}}});
   return rows.map(({saasSubscription,...row})=>({...row,assignment:saasSubscription}));
  });
 }
 async overview(u:string){
  return prisma.$transaction(async tx=>{
   if(!await this.operator(tx,u))throw new SaasDenied('Platform operator required');
   const now=new Date();
   const active={OR:[{validUntil:null},{validUntil:{gt:now}}]};
   const [solo,institutional,activePro,activeAcademy,expired]=await Promise.all([
    tx.workspace.count({where:{type:'SOLO'}}),
    tx.workspace.count({where:{type:'ACADEMY'}}),
    tx.saasSubscription.count({where:{plan:'PRO',...active}}),
    tx.saasSubscription.count({where:{plan:'ACADEMY',...active}}),
    tx.saasSubscription.count({where:{plan:{in:['PRO','ACADEMY']},validUntil:{lte:now}}}),
   ]);
   const academies=solo+institutional;
   return {academies,solo,institutional,activePro,activeAcademy,starter:Math.max(0,academies-activePro-activeAcademy),expired};
  },{isolationLevel:'RepeatableRead'});
 }
 async audit(u:string,w:string,after:string|null){
  return prisma.$transaction(async tx=>{
   if(!await this.operator(tx,u))throw new SaasDenied('Platform operator required');
   if(!await tx.workspace.findUnique({where:{id:w},select:{id:true}}))throw new SaasMissing('Academy not found');
   const cursor=after?await tx.saasPlanChange.findFirst({where:{workspaceId:w,id:after},select:{id:true,createdAt:true}}):null;
   if(after&&!cursor)throw new SaasMissing('Audit cursor not found');
   return tx.saasPlanChange.findMany({where:{workspaceId:w,...(cursor?{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,id:{lt:cursor.id}}]}:{})},
    orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,
    select:{id:true,actorUserId:true,previousPlan:true,nextPlan:true,validUntil:true,reason:true,createdAt:true}});
  });
 }
 async assign(u:string,w:string,input:{plan:PlanCode;validUntil:Date|null;reason:string}){
  return prisma.$transaction(async tx=>{
   await lockPlan(tx,w);
   if(!await this.operator(tx,u))throw new SaasDenied('Platform operator required');
   if(!await tx.workspace.findUnique({where:{id:w},select:{id:true}}))throw new SaasMissing('Academy not found');
   const old=await tx.saasSubscription.findUnique({where:{workspaceId:w}});
   const paid=await tx.saasBillingOrder.findFirst({where:{workspaceId:w,status:'PAID',periodEnd:{gt:new Date()}},orderBy:{periodEnd:'desc'},select:{plan:true,periodEnd:true}});
   if(paid&&(!paid.periodEnd||input.plan!==paid.plan||!input.validUntil||input.validUntil<paid.periodEnd))throw new SaasInvalid('Manual changes cannot shorten or replace a recorded paid period');
   const data={plan:input.plan,validUntil:input.validUntil};
   const row=await tx.saasSubscription.upsert({where:{workspaceId:w},create:{workspaceId:w,...data},update:data,select:{plan:true,validUntil:true}});
   await tx.saasPlanChange.create({data:{workspaceId:w,actorUserId:u,previousPlan:old?.plan??'STARTER',nextPlan:row.plan,validUntil:row.validUntil,reason:input.reason}});
   return row;
  });
 }
}
