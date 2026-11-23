import {z} from 'zod';

/**
 * National public rest days for Colombia.
 * Ley 51 de 1983 (Ley Emiliani): https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4954
 * Ley 2578 de 2026, art. 6: https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=193309
 * Extensible registry: do not silently fabricate public holidays for unsupported countries.
 */
export const holidayCountrySchema=z.enum(['CO','NONE']);
export const holidaySettingsInput=z.object({
 holidayCountry:holidayCountrySchema.optional(),
 avoidPublicHolidays:z.boolean().optional(),
}).refine(input=>Object.values(input).some(x=>x!==undefined),'Provide a setting');
export type HolidayCountry=z.infer<typeof holidayCountrySchema>;
export type HolidaySettings={holidayCountry:string;avoidPublicHolidays:boolean;timezone:string};
export type PublicHoliday={date:string;name:string;country:'CO'};
export class InvalidHolidaySettings extends Error {
 constructor(readonly details:unknown){super('Invalid holiday policy settings');this.name='InvalidHolidaySettings';}
}
export function parseHolidaySettings(raw:unknown){
 const result=holidaySettingsInput.safeParse(raw);
 if(!result.success)throw new InvalidHolidaySettings(result.error.flatten());
 return result.data;
}
function utcDate(y:number,m:number,d:number){return new Date(Date.UTC(y,m-1,d));}
function dateKey(d:Date){return d.toISOString().slice(0,10);}
function after(date:Date,days:number){const d=new Date(date);d.setUTCDate(d.getUTCDate()+days);return d;}
function moveMonday(date:Date){
 const weekday=date.getUTCDay(); // Sunday=0, Monday=1.
 return after(date,(8-weekday)%7);
}
/** Gregorian computus (Meeus/Jones/Butcher). Returns Easter Sunday in UTC date form. */
export function easterSunday(year:number):Date {
 const a=year%19,b=Math.floor(year/100),c=year%100;
 const d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25);
 const g=Math.floor((b-f+1)/3);
 const h=(19*a+b-d-g+15)%30;
 const i=Math.floor(c/4),k=c%4;
 const l=(32+2*e+2*i-h-k)%7;
 const m=Math.floor((a+11*h+22*l)/451);
 const n=h+l-7*m+114;
 return utcDate(year,Math.floor(n/31),(n%31)+1);
}
export function colombiaPublicHolidays(year:number):PublicHoliday[]{
 if(!Number.isInteger(year)||year<1900||year>2100)throw new InvalidHolidaySettings('Unsupported year');
 const dates=new Map<string,string>();
 function add(date:Date,name:string){dates.set(dateKey(date),name);}
 const fixed:[number,number,string][]=[
  [1,1,'Año Nuevo'],[5,1,'Día del Trabajo'],[7,20,'Independencia de Colombia'],
  [8,7,'Batalla de Boyacá'],[12,8,'Inmaculada Concepción'],[12,25,'Navidad'],
 ];
 const moved:[number,number,string][]=[
  [1,6,'Reyes Magos'],[3,19,'San José'],[6,29,'San Pedro y San Pablo'],
  [8,15,'Asunción de María'],[10,12,'Día de la Raza'],
  [11,1,'Todos los Santos'],[11,11,'Independencia de Cartagena'],
 ];
 if(year>=2026)moved.push([7,9,'Nuestra Señora del Rosario de Chiquinquirá']);
 for(const [month,day,name] of fixed)add(utcDate(year,month,day),name);
 for(const [month,day,name] of moved)add(moveMonday(utcDate(year,month,day)),name);
 const easter=easterSunday(year);
 add(after(easter,-3),'Jueves Santo');
 add(after(easter,-2),'Viernes Santo');
 add(after(easter,43),'Ascensión del Señor');
 add(after(easter,64),'Corpus Christi');
 add(after(easter,71),'Sagrado Corazón de Jesús');
 return [...dates].sort(([a],[b])=>a.localeCompare(b))
  .map(([date,name])=>({date,name,country:'CO' as const}));
}
export function publicHolidays(country:string,year:number):PublicHoliday[]{
 if(country==='NONE')return [];
 if(country==='CO')return colombiaPublicHolidays(year);
 throw new InvalidHolidaySettings('No public holiday provider configured for country '+country);
}
function localDay(date:Date,timezone:string):string{
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',
 }).formatToParts(date);
 const m=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return m.year+'-'+m.month+'-'+m.day;
}
/** End is exclusive; an event ending at midnight does not occupy the next holiday. */
export function holidayWithinWindow(
 start:Date,end:Date,timezone:string,country:string,
):PublicHoliday|null {
 if(country==='NONE')return null;
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)
  throw new InvalidHolidaySettings('Invalid class dates');
 const first=localDay(start,timezone),last=localDay(new Date(end.getTime()-1),timezone);
 const startYear=Number(first.slice(0,4)),endYear=Number(last.slice(0,4));
 const days=[...new Array(endYear-startYear+1)].flatMap((_,i)=>
  publicHolidays(country,startYear+i));
 return days.find(holiday=>holiday.date>=first&&holiday.date<=last)??null;
}
export function holidayConflict(
 settings:HolidaySettings,startsAt:Date,endsAt:Date,
):PublicHoliday|null{
 if(!settings.avoidPublicHolidays)return null;
 return holidayWithinWindow(startsAt,endsAt,settings.timezone,settings.holidayCountry);
}
