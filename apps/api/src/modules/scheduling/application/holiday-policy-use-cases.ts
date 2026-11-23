import type {MembershipPort} from '../../academics/application/ports.js';
import {
  parseHolidaySettings,publicHolidays,InvalidHolidaySettings,
} from '../domain/public-holidays.js';
import type {HolidayPolicyRepository} from './holiday-policy-ports.js';

export class HolidayPolicyAccessDenied extends Error {
  constructor(){super('You cannot change the academy holiday policy');this.name='HolidayPolicyAccessDenied';}
}
export class HolidayPolicyMissing extends Error {
  constructor(){super('Academy holiday settings not found');this.name='HolidayPolicyMissing';}
}
export class HolidayPolicyUseCases {
  constructor(private readonly repo:HolidayPolicyRepository,private readonly members:MembershipPort){}
  async read(workspaceId:string,actorId:string){
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN','TEACHER'])){
      throw new HolidayPolicyAccessDenied();
    }
    return this.repo.read(workspaceId,actorId);
  }
  async update(workspaceId:string,actorId:string,raw:unknown){
    if(!workspaceId||!actorId||!await this.members.hasAnyRole(workspaceId,actorId,['OWNER','ADMIN'])){
      throw new HolidayPolicyAccessDenied();
    }
    return this.repo.update(workspaceId,actorId,parseHolidaySettings(raw));
  }
  async calendar(workspaceId:string,actorId:string,yearRaw:unknown){
    const year=typeof yearRaw==='string'?Number(yearRaw):NaN;
    if(!Number.isInteger(year)||year<1900||year>2100){
      throw new InvalidHolidaySettings('Year must be a four-digit year from 1900 to 2100');
    }
    const policy=await this.read(workspaceId,actorId);
    return {...policy,year,holidays:publicHolidays(policy.holidayCountry,year)};
  }
}
