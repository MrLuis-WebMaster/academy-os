import 'dotenv/config';
import {prisma} from '../lib/prisma.js';
import {configuredWompi} from '../modules/commerce/infrastructure/wompi-config.js';
import {PrismaPaymentReconciliation} from '../modules/commerce/infrastructure/prisma-payment-reconciliation.js';
import {PrismaPackageCheckoutRepository} from '../modules/commerce/infrastructure/prisma-package-checkout-repository.js';
import {ReconcilePayments} from '../modules/commerce/application/payment-reconciliation.js';
const gateway=configuredWompi();
if(process.env.ACADEMY_PAYMENT_RECONCILIATION_ENABLED!=='true'||!gateway.config()){
 await prisma.$disconnect();throw new Error('Payment reconciliation disabled or gateway not configured');
}
const job=new ReconcilePayments(new PrismaPaymentReconciliation(),new PrismaPackageCheckoutRepository(),gateway);
let active=false,stopping=false;
async function tick(){
 if(active||stopping)return;
 active=true;
 try{const result=await job.execute();console.info('Payment reconciliation scan',result);}
 finally{active=false;}
}
if(process.argv.includes('--once')){
 try{await tick();}finally{await prisma.$disconnect();}
}else{
 const run=()=>void tick().catch(()=>console.error('Payment reconciliation scan failed'));
 const timer=setInterval(run,60_000);
 const stop=async()=>{if(stopping)return;stopping=true;clearInterval(timer);while(active)await new Promise(r=>setTimeout(r,200));await prisma.$disconnect();process.exit(0);};
 process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());run();
}
