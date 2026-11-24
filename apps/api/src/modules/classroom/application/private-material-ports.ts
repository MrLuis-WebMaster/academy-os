import type {PrivateMaterialInput} from '../domain/private-material.js';
export type PrivateMaterialRow={id:string;courseId:string|null;title:string;published:boolean;filename:string;mimeType:string;sizeBytes:number;createdAt:Date};
export type PrivateMaterialDownload={filename:string;mimeType:string;content:Uint8Array};
export interface PrivateMaterialRepository{
 list(workspaceId:string,userId:string):Promise<PrivateMaterialRow[]>;
 create(workspaceId:string,userId:string,input:PrivateMaterialInput):Promise<PrivateMaterialRow>;
 setPublished(workspaceId:string,userId:string,id:string,published:boolean):Promise<{id:string;published:boolean}>;
 remove(workspaceId:string,userId:string,id:string):Promise<void>;
 download(workspaceId:string,userId:string,id:string):Promise<PrivateMaterialDownload>;
}
