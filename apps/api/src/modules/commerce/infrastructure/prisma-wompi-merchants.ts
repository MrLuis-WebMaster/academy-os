import {createHash} from 'node:crypto';
import {prisma} from '../../../lib/prisma.js';
import type {Prisma} from '../../../generated/prisma/client.js';
import {OAuthCrypto} from '../../integrations/infrastructure/oauth-crypto.js';
import {CheckoutUnavailable,CheckoutConflict,CheckoutDisabled} from '../domain/checkout.js';
import {parseMerchantCredentials,merchantContext,type MerchantCredentials,type MerchantStatus} from '../domain/merchant.js';
import type {MerchantRepository,MerchantGatewayResolver} from '../application/merchant-ports.js';
import {WompiGateway} from './wompi-gateway.js';
import {configuredWompi} from './wompi-config.js';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function lockMerchant(tx:Prisma.TransactionClient,w:string){
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'academy-os:merchant:'+w}))::text`;
}
export class PrismaWompiMerchants implements MerchantRepository,MerchantGatewayResolver{
 private readonly crypto:OAuthCrypto;
 constructor(private readonly enabled:boolean,key:Buffer|undefined,private readonly webOrigin:string,private readonly pilot=configuredWompi()){
  this.crypto=new OAuthCrypto(key);this.available=enabled&&key?.length===32;
 }
 private readonly available:boolean;
 legacy(){return this.pilot;}
 private pilotWorkspace(){return this.pilot.config()?.workspaceId??null;}
 private async owner(tx:Prisma.TransactionClient,w:string,u:string){
  if(!await tx.workspaceMember.findFirst({where:{workspaceId:w,userId:u,role:'OWNER',user:{emailVerified:true}},select:{id:true}}))throw new CheckoutUnavailable('Verified academy owner required');
 }
 private view(w:string,row:{acceptingPayments:boolean}|null):MerchantStatus{
  return {configured:!!row,acceptingPayments:row?.acceptingPayments??false,available:this.available&&this.pilotWorkspace()!==w,environment:'test',webhookPath:'/api/v1/payments/wompi/workspaces/'+encodeURIComponent(w)+'/events'};
 }
 async status(w:string,u:string){
  return prisma.$transaction(async tx=>{await this.owner(tx,w,u);return this.view(w,await tx.wompiMerchant.findUnique({where:{workspaceId:w},select:{acceptingPayments:true}}));});
 }
 async configure(w:string,u:string,credentials:MerchantCredentials){
  if(!this.available||this.pilotWorkspace()===w)throw new CheckoutDisabled('Workspace merchant setup unavailable');
  const publicKeyHash=hash(credentials.publicKey);
  if(this.pilot.config()?.merchantKeyHash===publicKeyHash)throw new CheckoutConflict('Merchant already reserved');
  try{
   return await prisma.$transaction(async tx=>{
    await lockMerchant(tx,w);await this.owner(tx,w,u);
    // Prevent changing credentials while any checkout history exists: no loss of reconciliation keys.
    if(await tx.packageCheckout.count({where:{order:{workspaceId:w}}}))throw new CheckoutConflict('Merchant credentials cannot change while checkout history exists');
    const encryptedCredentials=this.crypto.seal(JSON.stringify(credentials),merchantContext(w,publicKeyHash));
    const data={publicKeyHash,encryptedCredentials,configuredByUserId:u,acceptingPayments:false};
    const row=await tx.wompiMerchant.upsert({where:{workspaceId:w},create:{workspaceId:w,...data},update:data,select:{acceptingPayments:true}});
    return this.view(w,row);
   });
  }catch(e){
   if(e&&typeof e==='object'&&'code'in e&&e.code==='P2002')throw new CheckoutConflict('Merchant already reserved');
   throw e;
  }
 }
 async setAccepting(w:string,u:string,accepting:boolean){
  if(!this.available||this.pilotWorkspace()===w)throw new CheckoutDisabled('Workspace merchant setup unavailable');
  return prisma.$transaction(async tx=>{
   await lockMerchant(tx,w);await this.owner(tx,w,u);
   const row=await tx.wompiMerchant.findUnique({where:{workspaceId:w},select:{workspaceId:true}});
   if(!row)throw new CheckoutUnavailable('Configure a merchant first');
   return this.view(w,await tx.wompiMerchant.update({where:{workspaceId:w},data:{acceptingPayments:accepting},select:{acceptingPayments:true}}));
  });
 }
 async resolve(w:string,forNewPayment:boolean){
  const pilot=this.pilot.config();if(pilot?.workspaceId===w)return this.pilot;
  if(!this.available)return null;
  const row=await prisma.wompiMerchant.findUnique({where:{workspaceId:w}});
  if(!row||(forNewPayment&&!row.acceptingPayments)||pilot?.merchantKeyHash===row.publicKeyHash)return null;
  try{
   const credentials=parseMerchantCredentials(JSON.parse(this.crypto.open(row.encryptedCredentials,merchantContext(w,row.publicKeyHash))));
   if(hash(credentials.publicKey)!==row.publicKeyHash)return null;
   const gateway=new WompiGateway({enabled:true,workspaceId:w,environment:'test',...credentials,issuerId:'',webOrigin:this.webOrigin,workspaceConfigured:true});
   return gateway.config()?gateway:null;
  }catch{throw new CheckoutDisabled('Merchant credentials unavailable');}
 }
 async workspaces(after:string|null){
  if(!this.available)return [];
  return prisma.wompiMerchant.findMany({where:after?{workspaceId:{gt:after}}:{},orderBy:{workspaceId:'asc'},take:10,select:{workspaceId:true}});
 }
}
export function configuredWorkspaceMerchants(){
 const key=process.env.ACADEMY_MERCHANT_ENCRYPTION_KEY||'';
 return new PrismaWompiMerchants(process.env.ACADEMY_WORKSPACE_WOMPI_ENABLED==='true'&&process.env.ACADEMY_PACKAGE_ORDERS_ENABLED==='true',/^[a-fA-F0-9]{64}$/.test(key)?Buffer.from(key,'hex'):undefined,process.env.WEB_ORIGIN||'http://localhost:5173');
}
