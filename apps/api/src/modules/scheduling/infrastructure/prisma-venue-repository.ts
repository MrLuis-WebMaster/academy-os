import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import type {VenueRepository,CreateCampus,ChangeCampus,CreateRoom,ChangeRoom} from '../application/venue-ports.js';
import {VenueAccessDenied,VenueConflict,VenueNotFound} from '../application/venue-use-cases.js';

function translateUnique(error:unknown):never{
 if(typeof error==='object'&&error!==null&&'code'in error&&error.code==='P2002'){
  throw new VenueConflict('This campus or room name is already used at this location');
 }
 throw error;
}
export class PrismaVenueRepository implements VenueRepository {
 private async authorize(tx:Prisma.TransactionClient,workspaceId:string,userId:string,write:boolean){
  if(!await tx.workspaceMember.findFirst({
   where:{workspaceId,userId,role:{in:write?['OWNER','ADMIN']:['OWNER','ADMIN','TEACHER']}},
   select:{id:true},
  }))throw new VenueAccessDenied();
 }

 async list(workspaceId:string,userId:string){
  const member=await prisma.workspaceMember.findFirst({
   where:{workspaceId,userId,role:{in:['OWNER','ADMIN','TEACHER']}},select:{id:true},
  });
  if(!member)throw new VenueAccessDenied();
  return prisma.campus.findMany({
   where:{workspaceId},
   select:{
    id:true,name:true,address:true,active:true,
    rooms:{select:{id:true,campusId:true,name:true,capacity:true,active:true},orderBy:{name:'asc'}},
   },
   orderBy:{name:'asc'},take:100,
  });
 }

 async createCampus(workspaceId:string,userId:string,data:CreateCampus){
  try{
   return await prisma.$transaction(async tx=>{
    await this.authorize(tx,workspaceId,userId,true);
    return tx.campus.create({
     data:{workspaceId,...data},
     select:{id:true,name:true,address:true,active:true},
    });
   });
  }catch(error){return translateUnique(error);}
 }

 async changeCampus(workspaceId:string,userId:string,campusId:string,data:ChangeCampus){
  try{
   return await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:campus:'+campusId}))::text AS lock_acquired`;
    await this.authorize(tx,workspaceId,userId,true);
    const campus=await tx.campus.findFirst({
     where:{workspaceId,id:campusId},select:{id:true,active:true},
    });
    if(!campus)throw new VenueNotFound();
    if(data.active===false){
     const rooms=await tx.teachingRoom.findMany({
      where:{workspaceId,campusId},select:{id:true},orderBy:{id:'asc'},
     });
     for(const room of rooms){
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:room:'+room.id}))::text AS lock_acquired`;
     }
     const used=await tx.classSession.findFirst({
      where:{
       workspaceId,status:'CONFIRMED',startsAt:{gt:new Date()},
       roomId:{in:rooms.map(room=>room.id)},
      },select:{id:true},
     });
     if(used)throw new VenueConflict('Move upcoming classes before deactivating this campus');
    }
    return tx.campus.update({
     where:{id:campusId},data,
     select:{id:true,name:true,address:true,active:true},
    });
   });
  }catch(error){return translateUnique(error);}
 }

 async createRoom(workspaceId:string,userId:string,campusId:string,data:CreateRoom){
  try{
   return await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:campus:'+campusId}))::text AS lock_acquired`;
    await this.authorize(tx,workspaceId,userId,true);
    const campus=await tx.campus.findFirst({
     where:{id:campusId,workspaceId},select:{id:true,active:true},
    });
    if(!campus)throw new VenueNotFound();
    if(!campus.active)throw new VenueConflict('Reactivate the campus before adding classrooms');
    return tx.teachingRoom.create({
     data:{workspaceId,campusId,...data},
     select:{id:true,campusId:true,name:true,capacity:true,active:true},
    });
   });
  }catch(error){return translateUnique(error);}
 }

 async changeRoom(workspaceId:string,userId:string,roomId:string,data:ChangeRoom){
  try{
   return await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:room:'+roomId}))::text AS lock_acquired`;
    await this.authorize(tx,workspaceId,userId,true);
    const room=await tx.teachingRoom.findFirst({
     where:{workspaceId,id:roomId},select:{id:true,capacity:true,active:true},
    });
    if(!room)throw new VenueNotFound();
    if((data.capacity!==undefined&&data.capacity<room.capacity)||data.active===false){
     const upcoming=await tx.classSession.findMany({
      where:{workspaceId,roomId,status:'CONFIRMED',startsAt:{gt:new Date()}},
      select:{capacity:true},
     });
     if(data.active===false&&upcoming.length){
      throw new VenueConflict('Move future classes before disabling this room');
     }
     if(data.capacity!==undefined&&upcoming.some(item=>item.capacity>data.capacity!)){
      throw new VenueConflict('The new room capacity is below an upcoming class size');
     }
    }
    return tx.teachingRoom.update({
     where:{id:roomId},data,
     select:{id:true,campusId:true,name:true,capacity:true,active:true},
    });
   });
  }catch(error){return translateUnique(error);}
 }
}
