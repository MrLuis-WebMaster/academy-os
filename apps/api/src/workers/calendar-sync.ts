import 'dotenv/config';
import {prisma} from '../lib/prisma.js';
import {ProcessCalendarSyncQueue} from '../modules/integrations/application/calendar-sync-worker.js';
import {ExportClassToCalendar} from '../modules/integrations/application/calendar-use-cases.js';
import {PrismaCalendarSyncQueue} from '../modules/integrations/infrastructure/prisma-calendar-sync-queue.js';
import {PrismaCalendarExport} from '../modules/integrations/infrastructure/prisma-calendar-export.js';
import {GoogleCalendarEvents} from '../modules/integrations/infrastructure/google-calendar-events.js';
import {OAuthCrypto} from '../modules/integrations/infrastructure/oauth-crypto.js';

const keyHex=process.env.INTEGRATION_ENCRYPTION_KEY||'';
const clientId=process.env.GOOGLE_INTEGRATIONS_CLIENT_ID||'',clientSecret=process.env.GOOGLE_INTEGRATIONS_CLIENT_SECRET||'';
if(process.env.GOOGLE_CALENDAR_SYNC_WORKER_ENABLED!=='true'||process.env.GOOGLE_CALENDAR_ENABLED!=='true'||
 !/^[a-fA-F0-9]{64}$/.test(keyHex)||!clientId||!clientSecret){
 await prisma.$disconnect();
 throw new Error('Calendar worker is disabled or Google Calendar credentials are missing');
}
const exporter=new ExportClassToCalendar(new PrismaCalendarExport(),new GoogleCalendarEvents({
 clientId,clientSecret,enabled:true,redirectUri:new URL('/api/v1/integrations/google-calendar/callback',process.env.WEB_ORIGIN||'http://localhost:5173').toString(),
}),new OAuthCrypto(Buffer.from(keyHex,'hex')));
const job=new ProcessCalendarSyncQueue(new PrismaCalendarSyncQueue(),exporter);
let active=false,stopping=false;
async function tick(){
 if(active||stopping)return;
 active=true;
 try{const result=await job.execute();console.info('Calendar sync scan',result);}
 catch{console.error('Calendar sync scan failed');}
 finally{active=false;}
}
if(process.argv.includes('--once')){
 await tick();await prisma.$disconnect();
}else{
 const timer=setInterval(()=>void tick(),60_000);
 const stop=async()=>{
  if(stopping)return;stopping=true;clearInterval(timer);
  while(active)await new Promise(resolve=>setTimeout(resolve,200));
  await prisma.$disconnect();process.exit(0);
 };
 process.on('SIGINT',()=>void stop());
 process.on('SIGTERM',()=>void stop());
 await tick();
}
