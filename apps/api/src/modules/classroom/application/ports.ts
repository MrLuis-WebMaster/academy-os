import type {CreateExternalMaterial} from '../domain/material.js';

export interface ManagedMaterial {
  id:string;title:string;url:string|null;courseId:string|null;
  published:boolean;source:string;aiAuthorized:boolean;
}
export interface CreatedMaterial {
  id:string;title:string;url:string|null;courseId:string|null;published:boolean;
}
export interface MaterialRepository {
  listByWorkspace(workspaceId:string):Promise<ManagedMaterial[]>;
  /** Performs a second OWNER/ADMIN and course-scope check in the same transaction as the insert. */
  create(workspaceId:string,actorId:string,material:CreateExternalMaterial):Promise<CreatedMaterial>;
  /** Atomically checks manager role, workspace, course ownership and publishability. */
  setPublished(workspaceId:string,actorId:string,materialId:string,published:boolean):
    Promise<{id:string;published:boolean}>;
}
