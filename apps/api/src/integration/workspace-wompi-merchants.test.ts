import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {prisma} from '../lib/prisma.js';
import {PrismaWompiMerchants} from '../modules/commerce/infrastructure/prisma-wompi-merchants.js';
import {WompiGateway} from '../modules/commerce/infrastructure/wompi-gateway.js';
import {OAuthCrypto} from '../modules/integrations/infrastructure/oauth-crypto.js';
import {parseMerchantCredentials,merchantContext} from '../modules/commerce/domain/merchant.js';
import {CheckoutConflict,CheckoutUnavailable,type CheckoutRecord} from '../modules/commerce/domain/checkout.js';
import {PrismaPackageOrderRepository} from '../modules/commerce/infrastructure/prisma-package-order-repository.js';
import {PrismaPackageCheckoutRepository} from '../modules/commerce/infrastructure/prisma-package-checkout-repository.js';
const credentials=(suffix:string)=>({publicKey:'pub_test_'+suffix,privateKey:'prv_test_'+suffix,integrityKey:'test_integrity_'+suffix,eventsKey:'test_events_'+suffix});
test('sandbox only and encrypted credentials bound to workspace and key hash',()=>{
 const data=credentials('fixture');
 assert.deepEqual(parseMerchantCredentials(data),data);
 assert.throws(()=>parseMerchantCredentials({...data,publicKey:'pub_prod_live'}),CheckoutConflict);
 assert.throws(()=>parseMerchantCredentials({...data,eventsKey:'test_events_'}),CheckoutConflict);
 const crypto=new OAuthCrypto(randomBytes(32)),sealed=crypto.seal(JSON.stringify(data),merchantContext('a','hash'));
 assert.ok(!sealed.includes(data.privateKey));
 assert.deepEqual(JSON.parse(crypto.open(sealed,merchantContext('a','hash'))),data);
 assert.throws(()=>crypto.open(sealed,merchantContext('b','hash')));
});
test('PostgreSQL: independent verified owners, unique merchants, pause and preserved reconciliation',async()=>{
 const nonce=randomUUID().slice(0,12),key=randomBytes(32);
 const [owner,student]=await Promise.all([
  prisma.user.create({data:{name:'Owner',email:'merchant-owner-'+nonce+'@example.invalid',emailVerified:true}}),
  prisma.user.create({data:{name:'Student',email:'merchant-student-'+nonce+'@example.invalid',emailVerified:true}}),
 ]);
 const ids:string[]=[];
 const pilot=new WompiGateway({enabled:false,workspaceId:'',environment:'test',publicKey:'',privateKey:'',integrityKey:'',eventsKey:'',issuerId:'',webOrigin:'https://academy.example.invalid'});
 try{
  const a=await prisma.workspace.create({data:{name:'Merchant A',slug:'merchant-a-'+nonce,type:'ACADEMY',members:{create:[{role:'OWNER',userId:owner.id},{role:'STUDENT',userId:student.id}]}}});ids.push(a.id);
  const b=await prisma.workspace.create({data:{name:'Merchant B',slug:'merchant-b-'+nonce,type:'ACADEMY',members:{create:{role:'OWNER',userId:owner.id}}}});ids.push(b.id);
  const repo=new PrismaWompiMerchants(true,key,'https://academy.example.invalid',pilot),ca=credentials('a-'+nonce),cb=credentials('b-'+nonce);
  await assert.rejects(()=>repo.configure(a.id,student.id,ca),CheckoutUnavailable);
  const status=await repo.configure(a.id,owner.id,ca);
  assert.equal(status.acceptingPayments,false);assert.ok(!JSON.stringify(status).includes(ca.privateKey));
  assert.equal(await repo.resolve(a.id,true),null);
  await assert.rejects(()=>repo.configure(b.id,owner.id,ca),CheckoutConflict);
  await repo.configure(b.id,owner.id,cb);
  const stored=await prisma.wompiMerchant.findUniqueOrThrow({where:{workspaceId:a.id}});
  assert.ok(!stored.encryptedCredentials.includes(ca.privateKey));
  await repo.setAccepting(a.id,owner.id,true);
  const gateway=await repo.resolve(a.id,true),config=gateway?.config();assert.ok(gateway&&config);
  assert.equal(config.workspaceId,a.id);assert.notEqual((await repo.resolve(b.id,false))?.config()?.merchantKeyHash,config.merchantKeyHash);
  const plan=await prisma.classPackage.create({data:{workspaceId:a.id,title:'Test',priceCOP:10000,sessionCredits:2,validDays:30}});
  const order=await new PrismaPackageOrderRepository().create(a.id,student.id,{packageId:plan.id,requestId:randomUUID(),expectedPriceCOP:10000});
  const checkout=new PrismaPackageCheckoutRepository();
  const row=await checkout.create(a.id,student.id,order.id,config,gateway.reference(),new Date(Date.now()+60000));
  await assert.rejects(()=>repo.configure(a.id,owner.id,ca),CheckoutConflict);
  await repo.setAccepting(a.id,owner.id,false);
  assert.equal(await repo.resolve(a.id,true),null);
  assert.ok(await repo.resolve(a.id,false));
  await assert.rejects(()=>checkout.create(a.id,student.id,order.id,config,row.reference,row.expiresAt),CheckoutUnavailable);
  const payment={id:'merchant-tx-'+nonce,reference:row.reference,amountInCents:1000000,currency:'COP' as const,status:'APPROVED' as const};
  assert.equal((await checkout.apply((await repo.resolve(b.id,false))!.config()!,payment)).handled,false);
  assert.equal((await checkout.apply(config,payment)).resolution,'TEST_APPROVED');
  assert.equal(await prisma.classPackageEntitlement.count({where:{workspaceId:a.id}}),0);
 }finally{
  await prisma.workspace.deleteMany({where:{id:{in:ids}}});
  await prisma.user.deleteMany({where:{id:{in:[owner.id,student.id]}}});
  await prisma.$disconnect();
 }
});
