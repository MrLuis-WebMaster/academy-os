import type {MembershipPort} from '../../academics/application/ports.js';
import {parseReminderPreferences} from '../domain/reminder-policy.js';
import type {ReminderPreferenceRepository,ReminderDeliveryRepository} from './reminder-ports.js';

export class ReminderPreferenceAccessDenied extends Error {
  constructor(){super('Only students can configure their own academy reminders');this.name='ReminderPreferenceAccessDenied';}
}
export class ReminderPreferencesUseCases {
  constructor(private readonly repository:ReminderPreferenceRepository,private readonly members:MembershipPort){}
  private async authorize(workspaceId:string,actorId:string){
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['STUDENT'])){
      throw new ReminderPreferenceAccessDenied();
    }
  }
  async read(workspaceId:string,actorId:string){
    await this.authorize(workspaceId,actorId);
    return this.repository.read(workspaceId,actorId);
  }
  async save(workspaceId:string,actorId:string,raw:unknown){
    await this.authorize(workspaceId,actorId);
    return this.repository.save(workspaceId,actorId,parseReminderPreferences(raw));
  }
}
export class DeliverDueReminders {
  constructor(private readonly deliveries:ReminderDeliveryRepository){}
  async execute(now=new Date()){
    return this.deliveries.deliverDue(now);
  }
}
