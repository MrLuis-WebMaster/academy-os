import type {z} from 'zod';
import type {offeringInput,studioSettingsInput} from '../domain/studio.js';

export type StudioSettings=z.infer<typeof studioSettingsInput>;
export type StudioNewOffering=z.infer<typeof offeringInput>;
export interface StudioConfig {
  id:string;name:string;slug:string;description:string|null;contactUrl:string|null;
  publicEnabled:boolean;brandColor:string;logoUrl:string|null;timezone:string;
}
export interface StudioUpdateResult {
  id:string;slug:string;name:string;description:string|null;
  contactUrl:string|null;publicEnabled:boolean;brandColor:string;logoUrl:string|null;
}
export interface StudioOffer {
  id:string;title:string;description:string|null;priceCOP:number;durationMinutes:number;
  mode:'ONLINE'|'ONSITE'|'HYBRID';published:boolean;courseId:string|null;
}
export interface PublicOffer {
  id:string;title:string;description:string|null;priceCOP:number;durationMinutes:number;
  mode:'ONLINE'|'ONSITE'|'HYBRID';
  course:{title:string;subject:{name:string}|null}|null;
}
export interface PublicStudio {
  name:string;slug:string;description:string|null;brandColor:string;
  contactUrl:string|null;timezone:string;logoUrl:string|null;offerings:PublicOffer[];
}
export interface StudioRepository {
  publicStore(slug:string):Promise<PublicStudio|null>;
  config(workspaceId:string,actorId:string):Promise<StudioConfig>;
  update(workspaceId:string,actorId:string,input:StudioSettings):Promise<StudioUpdateResult>;
  offerings(workspaceId:string,actorId:string):Promise<StudioOffer[]>;
  create(workspaceId:string,actorId:string,input:StudioNewOffering):
    Promise<{id:string;title:string;priceCOP:number;published:boolean}>;
  setPublished(workspaceId:string,actorId:string,offeringId:string,published:boolean):
    Promise<{id:string;published:boolean}>;
}
