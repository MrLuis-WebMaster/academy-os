import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {PrismaWeeklySeriesRepository} from '../modules/scheduling/infrastructure/prisma-weekly-series-repository.js';
import {CreateWeeklySeriesUseCase,WeeklySeriesConflict} from '../modules/scheduling/application/create-weekly-series-use-case.js';
import {PrismaMembershipAdapter} from '../modules/academics/infrastructure/prisma-subject-repository.js';
import {PrismaTeacherTimeOffRepository} from '../modules/scheduling/infrastructure/prisma-teacher-time-off-repository.js';
import {TimeOffConflict} from '../modules/scheduling/application/manage-time-off-use-case.js';
import {ExportCalendarUseCase} from '../modules/calendar/application/export-calendar-use-case.js';
import {PrismaCalendarReadRepository} from '../modules/calendar/infrastructure/prisma-calendar-read-repository.js';

test('PostgreSQL: weekly series is atomic and respects teacher vacation blocks',async()=>{
 const nonce=randomUUID().replaceAll('-','').slice(0,16);
 const owner=await prisma.user.create({
  data:{email:'recurrence-'+nonce+'@example.invalid',name:'Weekly Test Admin'},
 });
 let workspaceId='';
 try{
  const workspace=await prisma.workspace.create({
   data:{slug:'series-'+nonce,name:'Test weekly series',type:'ACADEMY',timezone:'America/Bogota',
    members:{create:{userId:owner.id,role:'OWNER'}},
    teachers:{create:{userId:owner.id}},
   },
   select:{id:true,teachers:{select:{id:true}}},
  });
  workspaceId=workspace.id;
  const teacherProfileId=workspace.teachers[0]!.id;
  const series=new CreateWeeklySeriesUseCase(new PrismaWeeklySeriesRepository(),new PrismaMembershipAdapter());
  const start=new Date(Date.now()+14*24*60*60*1000);
  start.setUTCMinutes(0,0,0);
  const end=new Date(start.getTime()+60*60*1000);
  const input={
   teacherProfileId,title:'Taller semanal de matemáticas',
   mode:'ONSITE' as const,capacity:12,location:'Sede Centro',
   startsAt:start,endsAt:end,repeatWeeks:3,
  };
  const created=await series.execute(workspace.id,owner.id,input);
  assert.equal(created.count,3);
  assert.deepEqual(created.lessons.map(x=>x.seriesIndex),[0,1,2]);
  assert.equal(await prisma.classSession.count({
   where:{workspaceId:workspace.id,seriesId:created.seriesId},
  }),3);
  const calendar=new ExportCalendarUseCase(new PrismaCalendarReadRepository());
  const ics=await calendar.execute(workspace.id,owner.id);
  assert.equal(ics.split('\r\n').filter(line=>line==='BEGIN:VEVENT').length,3);

  // A collision on the second attempt must not persist any partial series or sessions.
  await assert.rejects(()=>series.execute(workspace.id,owner.id,input),WeeklySeriesConflict);
  assert.equal(await prisma.classSeries.count({where:{workspaceId:workspace.id}}),1);
  assert.equal(await prisma.classSession.count({where:{workspaceId:workspace.id}}),3);

  const repository=new PrismaTeacherTimeOffRepository();
  await assert.rejects(()=>repository.create(workspace.id,teacherProfileId,owner.id,{
   startsAt:created.lessons[1]!.startsAt,
   endsAt:created.lessons[1]!.endsAt,reason:'Vacaciones',
  }),TimeOffConflict);

  const absentStart=new Date(start.getTime()+2*24*60*60*1000);
  const absentEnd=new Date(absentStart.getTime()+24*60*60*1000);
  await repository.create(workspace.id,teacherProfileId,owner.id,{
   startsAt:absentStart,endsAt:absentEnd,reason:'Jornada libre',
  });
  await assert.rejects(()=>series.execute(workspace.id,owner.id,{
   ...input,startsAt:absentStart,endsAt:new Date(absentStart.getTime()+60*60*1000),
   repeatWeeks:2,
  }),WeeklySeriesConflict);
  assert.equal(await prisma.classSeries.count({where:{workspaceId:workspace.id}}),1);
 }finally{
  if(workspaceId)await prisma.workspace.deleteMany({where:{id:workspaceId}});
  await prisma.user.deleteMany({where:{id:owner.id}});
 }
});
