import type {MembershipPort} from '../../academics/application/ports.js';
import {
  parseOfferingVisibility,parseStudioIdentifier,parseStudioOffering,parseStudioSettings,
} from '../domain/studio.js';
import type {StudioRepository} from './studio-ports.js';

export class StudioAccessDenied extends Error {
  constructor(){super('Only academy managers can manage Profe Studio');this.name='StudioAccessDenied';}
}
export class StudioUnavailable extends Error {
  constructor(message='Academy storefront is not published'){super(message);this.name='StudioUnavailable';}
}
export class StudioCourseInvalid extends Error {
  constructor(){super('Course does not belong to this workspace');this.name='StudioCourseInvalid';}
}
export class StudioOfferingMissing extends Error {
  constructor(){super('Offering not found');this.name='StudioOfferingMissing';}
}

export class StudioUseCases {
  constructor(private readonly repository:StudioRepository,private readonly members:MembershipPort){}
  private async authorize(workspaceId:string,actorId:string):Promise<void>{
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN'])){
      throw new StudioAccessDenied();
    }
  }
  async publicStore(slug:unknown){
    const name=parseStudioIdentifier(slug);
    const studio=await this.repository.publicStore(name);
    if(!studio)throw new StudioUnavailable();
    return studio;
  }
  async config(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId);
    return this.repository.config(workspaceId,actorId);
  }
  async update(workspaceId:string,actorId:string,raw:unknown){
    await this.authorize(workspaceId,actorId);
    return this.repository.update(workspaceId,actorId,parseStudioSettings(raw));
  }
  async offerings(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId);
    return this.repository.offerings(workspaceId,actorId);
  }
  async create(workspaceId:string,actorId:string,raw:unknown){
    await this.authorize(workspaceId,actorId);
    return this.repository.create(workspaceId,actorId,parseStudioOffering(raw));
  }
  async setPublished(workspaceId:string,actorId:string,offeringId:unknown,raw:unknown){
    await this.authorize(workspaceId,actorId);
    return this.repository.setPublished(
      workspaceId,actorId,parseStudioIdentifier(offeringId),parseOfferingVisibility(raw),
    );
  }
}
