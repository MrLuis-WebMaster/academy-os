import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {BillingRepository} from '../application/billing-ports.js';
import {SaasDenied,SaasInvalid,SaasMissing} from '../domain/plan.js';
import {billingPeriod,type BillingPrice,type BillingRequest,type BillingReview} from '../domain/billing.js';
import {lockPlan} from './plan-policy.js';
const select={id:true,plan:true,interval:true,amountCOP:true,status:true,expiresAt:true,paidAt:true,periodStart:true,periodEnd:true,createdAt:true,paymentReference:true,resolutionNote:true} as const;
export class PrismaBillingRepository implements BillingRepository{
 constructor(private readonly operators:ReadonlySet<string>){}
 private async access(tx:Prisma.TransactionClient,w:string,u:string,platform:boolean,owner=false){
  if(platform){
   if(!this.operators.has(u)||!await tx.user.findFirst({where:{id:u,emailVerified:true},select:{id:true}}))throw new SaasDenied('Platform operator required');
   if(!await tx.workspace.findUnique({where:{id:w},select:{id:true}}))throw new SaasMissing('Academy not found');
  }else if(!await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:u,role:{in:owner?['OWNER']:['OWNER','ADMIN']},user:{emailVerified:true}},select:{id:true}}))throw new SaasDenied('Verified academy manager required');
 }
 async list(w:string,u:string,after:string|null,platform:boolean){
  return prisma.$transaction(async tx=>{
   await this.access(tx,w,u,platform);
   const cursor=after?await tx.saasBillingOrder.findFirst({where:{workspaceId:w,id:after},select:{id:true,createdAt:true}}):null;
   if(after&&!cursor)throw new SaasMissing('Billing cursor not found');
   return tx.saasBillingOrder.findMany({where:{workspaceId:w,...(cursor?{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,id:{lt:cursor.id}}]}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,select});
  });
 }
 async create(w:string,u:string,input:BillingRequest,prices:readonly BillingPrice[]){
  return prisma.$transaction(async tx=>{
   await lockPlan(tx,w);await this.access(tx,w,u,false,true);
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:saas-billing-request:'+input.requestId}))::text`;
   const prior=await tx.saasBillingOrder.findUnique({where:{requestId:input.requestId}});
   if(prior){
    if(prior.workspaceId!==w||prior.requestedByUserId!==u||prior.plan!==input.plan||prior.interval!==input.interval||prior.amountCOP!==input.expectedAmountCOP)throw new SaasInvalid('Request ID already used');
    return tx.saasBillingOrder.findUniqueOrThrow({where:{id:prior.id},select});
   }
   const price=prices.find(p=>p.plan===input.plan&&p.interval===input.interval);
   if(!price||price.amountCOP!==input.expectedAmountCOP)throw new SaasInvalid('Price unavailable or changed; refresh catalog');
   const now=new Date();
   const assignment=await tx.saasSubscription.findUnique({where:{workspaceId:w}});
   billingPeriod(assignment,input.plan,input.interval,now);
   if(await tx.saasBillingOrder.findFirst({where:{workspaceId:w,status:'PENDING',expiresAt:{gt:now}},select:{id:true}}))throw new SaasInvalid('An active billing request already exists');
   return tx.saasBillingOrder.create({data:{workspaceId:w,requestedByUserId:u,requestId:input.requestId,plan:input.plan,interval:input.interval,amountCOP:price.amountCOP,expiresAt:new Date(now.getTime()+7*86400000)},select});
  });
 }
 async cancel(w:string,u:string,id:string){
  return prisma.$transaction(async tx=>{
   await lockPlan(tx,w);await this.access(tx,w,u,false,true);
   const row=await tx.saasBillingOrder.findFirst({where:{workspaceId:w,id},select});
   if(!row)throw new SaasMissing('Billing request not found');
   if(row.status==='CANCELLED')return row;
   if(row.status!=='PENDING')throw new SaasInvalid('Only pending requests can be cancelled');
   return tx.saasBillingOrder.update({where:{id},data:{status:'CANCELLED'},select});
  });
 }
 async review(w:string,u:string,id:string,input:BillingReview){
  return prisma.$transaction(async tx=>{
   await lockPlan(tx,w);await this.access(tx,w,u,true);
   const row=await tx.saasBillingOrder.findFirst({where:{workspaceId:w,id},select});
   if(!row)throw new SaasMissing('Billing request not found');
   if(row.status==='PAID'&&input.action==='confirm'&&row.paymentReference===input.paymentReference&&row.amountCOP===input.amountCOP)return row;
   if(row.status==='REJECTED'&&input.action==='reject')return row;
   if(row.status!=='PENDING')throw new SaasInvalid('Billing request already resolved');
   if(input.action==='reject')return tx.saasBillingOrder.update({where:{id},data:{status:'REJECTED',resolutionNote:input.note},select});
   const now=new Date();
   if(row.expiresAt<=now)throw new SaasInvalid('Request expired; reconcile late payment externally');
   if(row.amountCOP!==input.amountCOP)throw new SaasInvalid('Payment amount must match the request');
   if(row.plan==='STARTER'||(row.interval!=='MONTHLY'&&row.interval!=='YEARLY'))throw new SaasInvalid('Invalid paid plan');
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:saas-billing-reference:'+input.paymentReference}))::text`;
   if(await tx.saasBillingOrder.findUnique({where:{paymentReference:input.paymentReference},select:{id:true}}))throw new SaasInvalid('Payment reference already used');
   const assignment=await tx.saasSubscription.findUnique({where:{workspaceId:w}});
   const period=billingPeriod(assignment,row.plan,row.interval,now);
   await tx.saasSubscription.upsert({where:{workspaceId:w},create:{workspaceId:w,plan:row.plan,validUntil:period.end},update:{plan:row.plan,validUntil:period.end}});
   await tx.saasPlanChange.create({data:{workspaceId:w,actorUserId:u,previousPlan:assignment?.plan??'STARTER',nextPlan:row.plan,validUntil:period.end,reason:'SaaS billing order '+id+': '+input.note}});
   return tx.saasBillingOrder.update({where:{id},data:{status:'PAID',paymentReference:input.paymentReference,paidByUserId:u,paidAt:now,periodStart:period.start,periodEnd:period.end,resolutionNote:input.note},select});
  });
 }
}
