import test from 'node:test';
import assert from 'node:assert/strict';
import {
 colombiaPublicHolidays,easterSunday,holidayWithinWindow,holidayConflict,parseHolidaySettings,
 InvalidHolidaySettings,
} from '../modules/scheduling/domain/public-holidays.js';
test('Colombia calendar follows Emiliani transfers, Easter and 2026 Chiquinquirá law',()=>{
 const holidays=colombiaPublicHolidays(2026);
 const byName=(name:string)=>holidays.find(x=>x.name===name)?.date;
 assert.equal(easterSunday(2026).toISOString().slice(0,10),'2026-04-05');
 assert.equal(byName('Reyes Magos'),'2026-01-12');
 assert.equal(byName('San José'),'2026-03-23');
 assert.equal(byName('Jueves Santo'),'2026-04-02');
 assert.equal(byName('Viernes Santo'),'2026-04-03');
 assert.equal(byName('Ascensión del Señor'),'2026-05-18');
 assert.equal(byName('Corpus Christi'),'2026-06-08');
 assert.equal(byName('Sagrado Corazón de Jesús'),'2026-06-15');
 assert.equal(byName('Nuestra Señora del Rosario de Chiquinquirá'),'2026-07-13');
 assert.equal(byName('Independencia de Cartagena'),'2026-11-16');
 assert.ok(!colombiaPublicHolidays(2025).some(x=>x.name.includes('Chiquinquirá')));
});
test('holiday blocking is explicitly opt-in and respects academy timezone',()=>{
 const start=new Date('2026-12-08T14:00:00Z');
 const end=new Date('2026-12-08T15:00:00Z');
 const base={holidayCountry:'CO',timezone:'America/Bogota'};
 assert.equal(holidayConflict({...base,avoidPublicHolidays:false},start,end),null);
 assert.equal(holidayConflict({...base,avoidPublicHolidays:true},start,end)?.date,'2026-12-08');
 assert.equal(holidayWithinWindow(
  new Date('2026-12-09T03:00:00Z'),new Date('2026-12-09T05:00:00Z'),
  'America/Bogota','CO',
 )?.date,'2026-12-08');
 assert.equal(holidayWithinWindow(
  new Date('2026-12-09T05:00:00Z'),new Date('2026-12-09T06:00:00Z'),
  'America/Bogota','CO',
 ),null);
 assert.equal(holidayConflict({...base,holidayCountry:'NONE',avoidPublicHolidays:true},start,end),null);
});
test('settings are strict and unsupported countries are not silently interpreted',()=>{
 assert.deepEqual(parseHolidaySettings({holidayCountry:'CO',avoidPublicHolidays:true}),{
  holidayCountry:'CO',avoidPublicHolidays:true,
 });
 assert.throws(()=>parseHolidaySettings({holidayCountry:'US'}),InvalidHolidaySettings);
 assert.throws(()=>parseHolidaySettings({}),InvalidHolidaySettings);
 assert.throws(()=>colombiaPublicHolidays(2201),InvalidHolidaySettings);
});
