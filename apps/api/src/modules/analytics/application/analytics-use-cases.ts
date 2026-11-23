import type {MembershipPort} from '../../academics/application/ports.js';
import {analyticsDateRange,parseAnalyticsPeriod} from '../domain/analytics-period.js';
import type {AnalyticsRepository} from './analytics-ports.js';

export class AnalyticsAccessDenied extends Error {
  constructor(){super('Only academy managers can view institutional analytics');this.name='AnalyticsAccessDenied';}
}
export class AnalyticsUseCases {
  constructor(private readonly analytics:AnalyticsRepository,private readonly members:MembershipPort){}
  async overview(workspaceId:string,userId:string,rawPeriod:unknown){
    if(!workspaceId||!userId||!await this.members.hasAnyRole(workspaceId,userId,['OWNER','ADMIN'])){
      throw new AnalyticsAccessDenied();
    }
    const period=parseAnalyticsPeriod(rawPeriod);
    const {start,end}=analyticsDateRange(new Date(),period);
    return this.analytics.overview(workspaceId,userId,start,end,period);
  }
}
