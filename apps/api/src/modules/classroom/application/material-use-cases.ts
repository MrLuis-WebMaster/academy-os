import type {MembershipPort} from '../../academics/application/ports.js';
import {parseExternalMaterial,parseMaterialId,parsePublication} from '../domain/material.js';
import type {MaterialRepository} from './ports.js';

export class MaterialAccessDenied extends Error {
  constructor(){super('Only academy owners and admins can manage materials');this.name='MaterialAccessDenied';}
}
export class MaterialCourseOutsideWorkspace extends Error {
  constructor(){super('Course does not belong to this academy');this.name='MaterialCourseOutsideWorkspace';}
}
export class MaterialNotFound extends Error {
  constructor(){super('Material not found in this academy');this.name='MaterialNotFound';}
}

export class MaterialUseCases {
  constructor(private readonly resources:MaterialRepository,private readonly members:MembershipPort){}

  private async authorize(workspaceId:string,actorId:string):Promise<void> {
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN'])){
      throw new MaterialAccessDenied();
    }
  }
  async list(workspaceId:string,actorId:string) {
    await this.authorize(workspaceId,actorId);
    return this.resources.listByWorkspace(workspaceId);
  }
  async create(workspaceId:string,actorId:string,raw:unknown) {
    await this.authorize(workspaceId,actorId);
    const material=parseExternalMaterial(raw);
    return this.resources.create(workspaceId,actorId,material);
  }
  async setPublished(workspaceId:string,actorId:string,materialId:unknown,raw:unknown) {
    await this.authorize(workspaceId,actorId);
    const id=parseMaterialId(materialId);
    const published=parsePublication(raw);
    return this.resources.setPublished(workspaceId,actorId,id,published);
  }
}
