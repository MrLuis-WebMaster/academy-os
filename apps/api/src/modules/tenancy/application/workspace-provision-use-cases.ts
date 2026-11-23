import {parseWorkspaceInput} from '../domain/workspace-provisioning.js';
import type {WorkspaceProvisionRepository} from './workspace-ports.js';

export class WorkspaceSlugTaken extends Error {
  constructor(){super('That workspace name or slug is already taken');this.name='WorkspaceSlugTaken';}
}
export class WorkspaceCreationFailed extends Error {
  constructor(){super('Unable to create workspace');this.name='WorkspaceCreationFailed';}
}
export class WorkspaceLoginRequired extends Error {
  constructor(){super('Sign in to manage academies');this.name='WorkspaceLoginRequired';}
}
export class WorkspaceProvisionUseCases {
  constructor(private readonly repository:WorkspaceProvisionRepository){}
  async list(userId:string){
    if(!userId)throw new WorkspaceLoginRequired();
    return this.repository.list(userId);
  }
  async create(userId:string,raw:unknown){
    if(!userId)throw new WorkspaceLoginRequired();
    const input=parseWorkspaceInput(raw);
    return this.repository.provision(userId,input);
  }
}
