import type {parseWorkspaceInput} from '../domain/workspace-provisioning.js';

export type ProvisionWorkspaceDraft=ReturnType<typeof parseWorkspaceInput>;
export interface WorkspaceSummary {
  role:'OWNER'|'ADMIN'|'TEACHER'|'STUDENT'|'GUARDIAN';
  workspace:{
    id:string;name:string;slug:string;type:'SOLO'|'ACADEMY';
    brandColor:string;timezone:string;
  };
}
export interface ProvisionedWorkspace {
  id:string;slug:string;name:string;type:'SOLO'|'ACADEMY';
  timezone:string;role:'OWNER';
}
export interface WorkspaceProvisionRepository {
  list(userId:string):Promise<WorkspaceSummary[]>;
  provision(userId:string,draft:ProvisionWorkspaceDraft):Promise<ProvisionedWorkspace>;
}
