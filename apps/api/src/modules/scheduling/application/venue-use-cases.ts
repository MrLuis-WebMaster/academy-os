import type {MembershipPort} from '../../academics/application/ports.js';
import {
 parseCampus,parseCampusPatch,parseRoom,parseRoomPatch,parseVenueId,
} from '../domain/venues.js';
import type {VenueRepository} from './venue-ports.js';

export class VenueAccessDenied extends Error {
 constructor(){super('Only academy managers may modify campuses and rooms');this.name='VenueAccessDenied';}
}
export class VenueNotFound extends Error {
 constructor(){super('Campus or room not found in this academy');this.name='VenueNotFound';}
}
export class VenueConflict extends Error {
 constructor(message='Campus or room conflicts with an active class'){super(message);this.name='VenueConflict';}
}
export class VenueUseCases {
 constructor(private readonly repo:VenueRepository,private readonly member:MembershipPort){}
 private async authorize(workspaceId:string,userId:string,write:boolean){
  if(!workspaceId||!userId||!await this.member.hasAnyRole(
   workspaceId,userId,write?['OWNER','ADMIN']:['OWNER','ADMIN','TEACHER'],
  ))throw new VenueAccessDenied();
 }
 async list(workspaceId:string,userId:string){
  await this.authorize(workspaceId,userId,false);
  return this.repo.list(workspaceId,userId);
 }
 async createCampus(workspaceId:string,userId:string,raw:unknown){
  await this.authorize(workspaceId,userId,true);
  return this.repo.createCampus(workspaceId,userId,parseCampus(raw));
 }
 async changeCampus(workspaceId:string,userId:string,campusId:unknown,raw:unknown){
  await this.authorize(workspaceId,userId,true);
  return this.repo.changeCampus(workspaceId,userId,parseVenueId(campusId),parseCampusPatch(raw));
 }
 async createRoom(workspaceId:string,userId:string,campusId:unknown,raw:unknown){
  await this.authorize(workspaceId,userId,true);
  return this.repo.createRoom(workspaceId,userId,parseVenueId(campusId),parseRoom(raw));
 }
 async changeRoom(workspaceId:string,userId:string,roomId:unknown,raw:unknown){
  await this.authorize(workspaceId,userId,true);
  return this.repo.changeRoom(workspaceId,userId,parseVenueId(roomId),parseRoomPatch(raw));
 }
}
