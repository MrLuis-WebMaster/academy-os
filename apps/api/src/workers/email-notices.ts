import 'dotenv/config';
import {prisma} from '../lib/prisma.js';
import {DeliverEmailNotices} from '../modules/notifications/application/email-notice-use-cases.js';
import {PrismaEmailNoticeQueue} from '../modules/notifications/infrastructure/prisma-email-notices.js';
import {ResendEmailProvider} from '../modules/notifications/infrastructure/resend-email-provider.js';
if(process.env.ACADEMY_EMAIL_NOTICES_ENABLED!=='true')throw new Error('Email delivery disabled');
const job=new DeliverEmailNotices(new PrismaEmailNoticeQueue(),new ResendEmailProvider(process.env.RESEND_API_KEY||'',process.env.ACADEMY_EMAIL_FROM||'',process.env.WEB_ORIGIN||''));
let running=false,stopping=false;
async function tick(){
 if(running||stopping)return;running=true;
 try{console.info('Email notice scan',await job.execute());}
 finally{running=false;}
}
if(process.argv.includes('--once')){
 try{await tick();}finally{await prisma.$disconnect();}
}else{
 const run=()=>void tick().catch(()=>console.error('Email notice scan failed'));
 const timer=setInterval(run,60000);
 const stop=async()=>{if(stopping)return;stopping=true;clearInterval(timer);while(running)await new Promise(r=>setTimeout(r,200));await prisma.$disconnect();process.exit(0);};
 process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());run();
}
