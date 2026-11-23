import type {z} from 'zod';
import type {campusInput,campusPatch,roomInput,roomPatch} from '../domain/venues.js';

export type CreateCampus=z.infer<typeof campusInput>;
export type ChangeCampus=z.infer<typeof campusPatch>;
export type CreateRoom=z.infer<typeof roomInput>;
export type ChangeRoom=z.infer<typeof roomPatch>;
export interface RoomView {
 id:string;campusId:string;name:string;capacity:number;active:boolean;
}
export interface CampusView {
 id:string;name:string;address:string;active:boolean;rooms:RoomView[];
}
export interface VenueRepository {
 list(workspaceId:string,actorId:string):Promise<CampusView[]>;
 createCampus(workspaceId:string,actorId:string,data:CreateCampus):Promise<{id:string;name:string;address:string;active:boolean}>;
 changeCampus(workspaceId:string,actorId:string,campusId:string,data:ChangeCampus):
  Promise<{id:string;name:string;address:string;active:boolean}>;
 createRoom(workspaceId:string,actorId:string,campusId:string,data:CreateRoom):Promise<RoomView>;
 changeRoom(workspaceId:string,actorId:string,roomId:string,data:ChangeRoom):Promise<RoomView>;
}
