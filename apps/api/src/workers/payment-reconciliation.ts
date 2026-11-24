import 'dotenv/config';
import {prisma} from '../lib/prisma.js';
import {configuredWorkspaceMerchants} from '../modules/commerce/infrastructure/prisma-wompi-merchants.js';
import {PrismaPaymentReconciliation} from '../modules/commerce/infrastructure/prisma-payment-reconciliation.js';
import {PrismaPackageCheckoutRepository} from '../modules/commerce/infrastructure/prisma-package-checkout-repository.js';
import {ReconcilePayments} from '../modules/commerce/application/payment-reconciliation.js';
const merchants=configuredWorkspaceMerchants(),gateway=merchants.legacy();
if(process.env.ACADEMY_PAYMENT_RECONCILIATION_ENABLED!=='true'||(!gateway.config()&&process.env.ACADEMY_WORKSPACE_WOMPI_ENABLED!=='true')){
 await prisma.$disconnect();throw new Error('Payment reconciliation disabled or gateway not configured');
}
const queue=new PrismaPaymentReconciliation(),repo=new PrismaPackageCheckoutRepository();
let cursor:string|null=null;
let active=false,stopping=false;
async function tick(){
 if(active||stopping)return;
 active=true;
 try{
  const legacy=await new ReconcilePayments(queue,repo,gateway).execute();
  const rows=await merchants.workspaces(cursor);let checked=legacy.checked,failed=legacy.failed;
  for(const row of rows){cursor=row.workspaceId;try{const scoped=await merchants.resolve(row.workspaceId,false);if(scoped&&scoped!==gateway){const result=await new ReconcilePayments(queue,repo,scoped).execute(1);checked+=result.checked;failed+=result.failed;}}catch{failed++;}}
  if(rows.length<10)cursor=null;
  console.info('Payment reconciliation scan',{checked,failed});
 }
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
