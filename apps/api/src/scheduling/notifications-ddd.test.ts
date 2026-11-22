import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionNotice,bookingNotice,enrollmentNotice,notificationId,InvalidNotificationIdentifier} from '../modules/notifications/domain/notification.js';
import {
 NotificationUseCases,NotificationAccessDenied,NotificationNotFound
} from '../modules/notifications/application/notification-use-cases.js';
import type {NotificationMailboxRepository,NotificationItem} from '../modules/notifications/application/ports.js';
import type {MembershipPort} from '../modules/academics/application/ports.js';

function testHarness(allowed:boolean){
 const messages:NotificationItem[]=[
  {id:'notice-1',kind:'SESSION_CANCELLED',title:'Clase cancelada',body:'',sessionId:'s1',createdAt:new Date(),readAt:null},
 ];
 const mailbox:NotificationMailboxRepository={
  async list(){return{items:messages,unreadCount:messages.filter(n=>!n.readAt).length};},
  async read(_w,_u,id){
   const item=messages.find(x=>x.id===id);
   if(!item)return false;item.readAt=new Date();return true;
  },
  async readAll(){for(const x of messages)x.readAt=new Date();return messages.length;},
 };
 const members:MembershipPort={hasAnyRole:async()=>allowed};
 return new NotificationUseCases(mailbox,members);
}
test('notice body only describes session; IDs are validated',()=>{
 const s=sessionNotice('SESSION_RESCHEDULED',' Geometría   1 ');
 assert.match(s.body,/Geometría 1/);
 assert.throws(()=>notificationId(' '),InvalidNotificationIdentifier);
 assert.equal(notificationId(' abc '),'abc');
});
test('read and read-all are user-scoped through a repository port',async()=>{
 const useCases=testHarness(true);
 assert.equal((await useCases.list('w','u')).unreadCount,1);
 await useCases.read('w','u','notice-1');
 assert.equal((await useCases.list('w','u')).unreadCount,0);
 await assert.rejects(()=>useCases.read('w','u','other'),NotificationNotFound);
 assert.equal((await useCases.readAll('w','u')).readCount,1);
});
test('workspace outsiders cannot read or change notifications',async()=>{
 const useCases=testHarness(false);
 await assert.rejects(()=>useCases.list('w','outsider'),NotificationAccessDenied);
 await assert.rejects(()=>useCases.read('w','outsider','notice-1'),NotificationAccessDenied);
 await assert.rejects(()=>useCases.readAll('w','outsider'),NotificationAccessDenied);
});

test('booking and enrollment notice titles contain no private profiles',()=>{
 assert.match(bookingNotice(' Aritmética ').body,/Aritmética/);
 assert.match(enrollmentNotice(' Inglés ').body,/Inglés/);
});
