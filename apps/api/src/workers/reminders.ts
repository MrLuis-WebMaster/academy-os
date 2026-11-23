import 'dotenv/config';
import {prisma} from '../lib/prisma.js';
import {DeliverDueReminders} from '../modules/notifications/application/reminder-use-cases.js';
import {PrismaReminderDelivery} from '../modules/notifications/infrastructure/prisma-reminder-delivery.js';

if(process.env.ACADEMY_IN_APP_REMINDERS_ENABLED!=='true'){
  throw new Error('Set ACADEMY_IN_APP_REMINDERS_ENABLED=true to run in-app reminder delivery');
}
const job=new DeliverDueReminders(new PrismaReminderDelivery());
let running=false,shuttingDown=false;
async function tick():Promise<void>{
  if(running||shuttingDown)return;
  running=true;
  try{
    const summary=await job.execute();
    console.info('In-app reminder scan',summary);
  }catch(error){
    // Do not log student data, URLs, message bodies or credentials.
    console.error('In-app reminder scan failed',error instanceof Error?error.name:'UnknownError');
  }finally{running=false;}
}
if(process.argv.includes('--once')){
  await tick();
  await prisma.$disconnect();
}else{
  const timer=setInterval(()=>void tick(),60_000);
  const shutdown=async()=>{
    if(shuttingDown)return;
    shuttingDown=true;clearInterval(timer);
    // Allow active transactions to complete before releasing connections.
    while(running)await new Promise(resolve=>setTimeout(resolve,200));
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT',()=>void shutdown());
  process.on('SIGTERM',()=>void shutdown());
  await tick();
  console.info('In-app reminder worker started');
}
