import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {GoogleConnectionRepository} from '../application/google-ports.js';
import {IntegrationDenied,InvalidAuthorization,type OAuthAttempt} from '../domain/google-connection.js';

async function lock(tx:Prisma.TransactionClient,workspaceId:string,userId:string){
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['google-calendar',workspaceId,userId])},0))::text`;
}
async function allow(tx:Prisma.TransactionClient,workspaceId:string,userId:string){
 const member=await tx.workspaceMember.findFirst({where:{workspaceId,userId,role:{in:['OWNER','ADMIN','TEACHER']}},select:{id:true}});
 if(!member)throw new IntegrationDenied('Not authorized to manage this connection');
}
export class PrismaGoogleConnection implements GoogleConnectionRepository{
 async status(workspaceId:string,userId:string){
  const connection=await prisma.externalConnection.findFirst({where:{workspaceId,userId,provider:'GOOGLE_CALENDAR',encryptedCredentials:{not:null}},select:{connectedAt:true}});
  return connection?.connectedAt??null;
 }
 async begin(attempt:OAuthAttempt){
  await prisma.$transaction(async tx=>{
   await lock(tx,attempt.workspaceId,attempt.userId);
   await allow(tx,attempt.workspaceId,attempt.userId);
   await tx.integrationOAuthAttempt.deleteMany({where:{OR:[
    {workspaceId:attempt.workspaceId,userId:attempt.userId},
    {expiresAt:{lt:new Date()}},
   ]}});
   await tx.integrationOAuthAttempt.create({data:attempt});
  });
 }
 async consume(stateHash:string,userId:string,now:Date){
  return prisma.$transaction(async tx=>{
   const claim=await tx.integrationOAuthAttempt.updateMany({where:{stateHash,userId,claimedAt:null,expiresAt:{gt:now}},data:{claimedAt:now}});
   if(claim.count!==1)return null;
   return tx.integrationOAuthAttempt.findUnique({where:{stateHash}});
  });
 }
 async save(attempt:OAuthAttempt,encryptedCredential:string){
  await prisma.$transaction(async tx=>{
   await lock(tx,attempt.workspaceId,attempt.userId);
   await allow(tx,attempt.workspaceId,attempt.userId);
   const state=await tx.integrationOAuthAttempt.deleteMany({where:{stateHash:attempt.stateHash,workspaceId:attempt.workspaceId,userId:attempt.userId,claimedAt:{not:null},expiresAt:{gt:new Date()}}});
   if(state.count!==1)throw new InvalidAuthorization('Connection request was cancelled or expired');
   await tx.externalConnection.upsert({
    where:{workspaceId_userId_provider:{workspaceId:attempt.workspaceId,userId:attempt.userId,provider:'GOOGLE_CALENDAR'}},
    create:{workspaceId:attempt.workspaceId,userId:attempt.userId,provider:'GOOGLE_CALENDAR',encryptedCredentials:encryptedCredential},
    update:{encryptedCredentials:encryptedCredential,connectedAt:new Date()},
   });
  });
 }
 async disconnect(workspaceId:string,userId:string){
  await prisma.$transaction(async tx=>{
   await lock(tx,workspaceId,userId);
   await allow(tx,workspaceId,userId);
   await tx.integrationOAuthAttempt.deleteMany({where:{workspaceId,userId}});
   await tx.externalConnection.deleteMany({where:{workspaceId,userId,provider:'GOOGLE_CALENDAR'}});
  });
 }
}
