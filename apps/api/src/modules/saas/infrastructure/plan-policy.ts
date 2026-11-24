import type {Prisma} from '../../../generated/prisma/client.js';
import {PLAN_LIMITS,effectivePlan} from '../domain/plan.js';
export async function lockPlan(tx:Prisma.TransactionClient,w:string){
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:saas-plan:'+w}))::text`;
}
export async function limitsFor(tx:Prisma.TransactionClient,w:string){
 const assignment=await tx.saasSubscription.findUnique({where:{workspaceId:w},select:{plan:true,validUntil:true}});
 return PLAN_LIMITS[effectivePlan(assignment)];
}
export function quotasEnabled(){return process.env.ACADEMY_SAAS_QUOTAS_ENABLED==='true';}
