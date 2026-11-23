import type {PublicHoliday} from '../domain/public-holidays.js';
import type {parseHolidaySettings} from '../domain/public-holidays.js';

export interface HolidayPolicySettings {
  holidayCountry:string;avoidPublicHolidays:boolean;timezone:string;
}
export interface HolidayCalendar extends HolidayPolicySettings {
  year:number;holidays:PublicHoliday[];
}
export type HolidayPolicyPatch=ReturnType<typeof parseHolidaySettings>;
export interface HolidayPolicyRepository {
  read(workspaceId:string,actorId:string):Promise<HolidayPolicySettings>;
  update(workspaceId:string,actorId:string,patch:HolidayPolicyPatch):Promise<HolidayPolicySettings>;
}
