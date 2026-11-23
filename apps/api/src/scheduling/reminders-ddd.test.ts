import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InvalidReminderPreferences,parseReminderPreferences,reminderDueWindow,reminderEventKey,
  reminderNotice,
} from '../modules/notifications/domain/reminder-policy.js';
import {
  ReminderPreferencesUseCases,ReminderPreferenceAccessDenied,DeliverDueReminders,
} from '../modules/notifications/application/reminder-use-cases.js';
import type {ReminderPreferenceRepository,ReminderDeliveryRepository} from '../modules/notifications/application/reminder-ports.js';
import type {MembershipPort,WorkspaceRole} from '../modules/academics/application/ports.js';

test('reminder preferences are explicit booleans; default delivery window is bounded',()=>{
  assert.deepEqual(parseReminderPreferences({remind24h:true,remind1h:false}),{
    remind24h:true,remind1h:false,
  });
  assert.throws(()=>parseReminderPreferences({remind24h:'yes',remind1h:true}),InvalidReminderPreferences);
  const now=new Date('2027-01-01T10:00:00.000Z');
  const range=reminderDueWindow(now,60);
  assert.equal(range.from.toISOString(),'2027-01-01T10:40:00.000Z');
  assert.equal(range.through.toISOString(),'2027-01-01T11:00:00.000Z');
  const key=reminderEventKey('class-x',new Date('2027-01-02T10:00:00Z'),'24h');
  assert.equal(key,'class-reminder:class-x:2027-01-02T10:00:00.000Z:24h');
  assert.ok(reminderNotice('Clase X',new Date('2027-01-02T10:00:00Z'),'America/Bogota','1h').title.includes('una hora'));
});
test('students are exclusively authorized to read and save in-app reminder preferences',async()=>{
  const calls:string[]=[];
  const member:MembershipPort={
    hasAnyRole:async(w,u,roles:readonly WorkspaceRole[])=>w==='a'&&u==='student'&&roles.includes('STUDENT'),
  };
  const repo:ReminderPreferenceRepository={
    read:async()=>{calls.push('read');return {remind24h:false,remind1h:false};},
    save:async(_,__,data)=>{calls.push('save');return data;},
  };
  const app=new ReminderPreferencesUseCases(repo,member);
  await assert.rejects(app.save('a','admin',{remind24h:true,remind1h:true}),ReminderPreferenceAccessDenied);
  await assert.rejects(app.read('b','student'),ReminderPreferenceAccessDenied);
  assert.deepEqual(calls,[]);
  assert.deepEqual(await app.save('a','student',{remind24h:true,remind1h:false}),{remind24h:true,remind1h:false});
  await app.read('a','student');
  assert.deepEqual(calls,['save','read']);
});
test('dispatch is decoupled from HTTP and is testable without external providers',async()=>{
  const deliveries:ReminderDeliveryRepository={deliverDue:async()=>({visitedSessions:2,createdNotifications:3})};
  const useCase=new DeliverDueReminders(deliveries);
  assert.deepEqual(await useCase.execute(new Date('2027-01-01T00:00:00Z')),{visitedSessions:2,createdNotifications:3});
});
