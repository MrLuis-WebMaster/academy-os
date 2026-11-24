<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import PaymentReconcile from './PaymentReconcile.vue';
import {ShoppingBag,RefreshCw} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
type Plan={id:string;title:string;priceCOP:number;sessionCredits:number;validDays:number;courseId:string|null};
type Order={id:string;packageId:string;title:string;priceCOP:number;credits:number;validDays:number;status:string;createdAt:string};
type Checkout={orderId:string;environment:string;providerStatus:string;resolution:string;expiresAt:string;transactionKnown:boolean};
const returnUrl=new URL(window.location.href);
const returnOrder=returnUrl.searchParams.get('paymentReturn')==='1'?returnUrl.searchParams.get('order')??'':'';
const returnId=returnOrder?returnUrl.searchParams.get('id')??'':'';
const safeReturnId=/^[a-zA-Z0-9_-]{1,128}$/.test(returnId)?returnId:'';
if(returnOrder){for(const key of ['paymentReturn','order','id'])returnUrl.searchParams.delete(key);window.history.replaceState({},'',returnUrl.pathname+returnUrl.search+returnUrl.hash);}
const reconciliationEnabled=ref(false);
const checkoutEnabled=ref(false),checkoutEnvironment=ref<string|null>(null),checkouts=ref<Checkout[]>([]);
const checkoutPath=(w:string)=>workspacePath(w,'/package-checkout');
const checkoutFor=(id:string)=>checkouts.value.find(x=>x.orderId===id);
const props=defineProps<{workspaceId:string}>();
const plans=ref<Plan[]>([]),orders=ref<Order[]>([]),enabled=ref(false),loading=ref(false),busy=ref(false),error=ref(''),notice=ref('');
let version=0;
const keys=new Map<string,string>();
const path=(w:string,suffix='')=>workspacePath(w,'/package-orders'+suffix);
const money=(v:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(v);
const labels:Record<string,string>={PENDING:'Pendiente de revisión',FULFILLED:'Créditos entregados',CANCELLED:'Cancelada',REJECTED:'Rechazada'};
async function load(){
 const w=props.workspaceId,n=++version;loading.value=true;enabled.value=false;checkoutEnabled.value=false;reconciliationEnabled.value=false;checkoutEnvironment.value=null;checkouts.value=[];plans.value=[];orders.value=[];error.value='';
 try{
  const [catalog,mine,checkout]=await Promise.all([apiJson<{enabled:boolean;items:Plan[]}>(path(w,'/catalog')),apiJson<Order[]>(path(w,'/mine')),apiJson<{enabled:boolean;reconciliationEnabled:boolean;environment:string|null;items:Checkout[]}>(checkoutPath(w))]);
  if(n!==version||w!==props.workspaceId)return;
  enabled.value=catalog.enabled;plans.value=catalog.items;orders.value=mine;checkoutEnabled.value=checkout.enabled;reconciliationEnabled.value=checkout.reconciliationEnabled;checkoutEnvironment.value=checkout.environment;checkouts.value=checkout.items;
 }catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo consultar el catálogo.';}
 finally{if(n===version)loading.value=false;}
}
async function request(plan:Plan){
 if(busy.value||!enabled.value||orders.value.some(o=>o.packageId===plan.id&&o.status==='PENDING'))return;
 if(!window.confirm('¿Solicitar '+plan.title+' por '+money(plan.priceCOP)+'? No se realizará ningún cobro. Coordina el pago con tu academia.'))return;
 const w=props.workspaceId,key=w+':'+plan.id+':'+plan.priceCOP;
 const requestId=keys.get(key)??crypto.randomUUID();keys.set(key,requestId);
 busy.value=true;error.value='';notice.value='';
 try{
  await apiJson(path(w),'POST',{packageId:plan.id,expectedPriceCOP:plan.priceCOP,requestId});
  keys.delete(key);
  if(w!==props.workspaceId)return;
  await load();if(w===props.workspaceId)notice.value='Solicitud registrada. La academia debe verificar el pago por separado antes de entregar créditos.';
 }catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo registrar la solicitud.';}
 finally{busy.value=false;}
}
async function pay(order:Order){
 if(busy.value||!checkoutEnabled.value||order.status!=='PENDING')return;
 const sandbox=checkoutEnvironment.value==='test';
 if(checkoutFor(order.id)&&!window.confirm('Si ya intentaste pagar, verifica primero el estado de la transacción. ¿Continuar al checkout?'))return;
 if(!window.confirm(sandbox?'¿Abrir checkout de pruebas? Usa únicamente datos de prueba; no se entregan créditos.':'¿Ir a Wompi para pagar '+money(order.priceCOP)+' a tu academia?'))return;
 const w=props.workspaceId;busy.value=true;error.value='';notice.value='';
 try{
  const result=await apiJson<{url:string}>(checkoutPath(w)+'/'+encodeURIComponent(order.id),'POST');
  if(w!==props.workspaceId)return;
  const url=new URL(result.url);
  if(url.origin!=='https://checkout.wompi.co'||url.pathname!=='/p/')throw Error('Destino de pago inválido.');
  window.location.assign(url.toString());
 }catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo abrir el checkout.';}
 finally{busy.value=false;}
}
async function cancel(order:Order){
 if(busy.value||!window.confirm('¿Cancelar esta solicitud? Si ya realizaste una transferencia, contacta a la academia antes de cancelar. No se realizará un reembolso automático.'))return;
 const w=props.workspaceId;busy.value=true;error.value='';notice.value='';
 try{
  await apiJson(path(w,'/'+encodeURIComponent(order.id)+'/cancel'),'PATCH');
  if(w!==props.workspaceId)return;
  await load();if(w===props.workspaceId)notice.value='Solicitud cancelada.';
 }catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo cancelar.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{notice.value='';void load();});onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><ShoppingBag :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Paquetes disponibles</h2><p class="mt-1 text-xs text-muted">Solicita clases y consulta el estado de tus compras.</p></div></div></template>
  <UiAlert tone="warning">Crear una solicitud no realiza cobros. Si el checkout está habilitado, puedes continuar a Wompi; de lo contrario, coordina el pago externo.</UiAlert>
  <UiAlert v-if="checkoutEnabled&&checkoutEnvironment==='test'" tone="warning">Wompi en modo de pruebas: no uses dinero real ni datos bancarios reales. No se entregan créditos.</UiAlert>
  <UiButton size="sm" variant="ghost" :disabled="loading||busy" @click="load"><RefreshCw :size="14"/> Actualizar catálogo e historial</UiButton>
  <p v-if="loading" class="text-xs text-muted">Consultando paquetes…</p>
  <p v-else-if="!enabled" class="text-xs text-muted">Las nuevas solicitudes están deshabilitadas.</p>
  <p v-else-if="!plans.length" class="text-xs text-muted">No hay paquetes disponibles para tus cursos.</p>
  <div v-else class="grid gap-3 sm:grid-cols-2">
   <article v-for="plan in plans" :key="plan.id" class="space-y-2 rounded-xl border border-outline p-4">
    <h3 class="text-sm font-extrabold">{{plan.title}}</h3><p class="text-xl font-extrabold">{{money(plan.priceCOP)}}</p><p class="text-xs text-muted">{{plan.sessionCredits}} créditos · {{plan.validDays}} días desde la entrega</p>
    <UiButton size="sm" :disabled="busy||orders.some(o=>o.packageId===plan.id&&o.status==='PENDING')" @click="request(plan)">{{orders.some(o=>o.packageId===plan.id&&o.status==='PENDING')?'Solicitud pendiente':'Solicitar paquete'}}</UiButton>
   </article>
  </div>
  <h3 class="mt-4 text-sm font-extrabold">Mis solicitudes</h3>
  <p v-if="!loading&&!orders.length" class="text-xs text-muted">Todavía no tienes solicitudes.</p>
  <div v-for="order in orders" :key="order.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-3">
   <div><p class="text-sm font-semibold">{{order.title}}</p><p class="text-xs text-muted">{{money(order.priceCOP)}} · {{labels[order.status]||order.status}} · {{new Date(order.createdAt).toLocaleDateString('es-CO')}}</p></div>
   <div class="flex flex-wrap gap-2">
    <span v-if="checkoutFor(order.id)" class="text-xs text-muted">Wompi: {{checkoutFor(order.id)?.providerStatus}} · {{checkoutFor(order.id)?.resolution}}</span>
    <UiButton v-if="checkoutEnabled&&order.status==='PENDING'&&(!checkoutFor(order.id)||(!checkoutFor(order.id)?.transactionKnown&&checkoutFor(order.id)?.providerStatus==='PENDING'&&new Date(checkoutFor(order.id)!.expiresAt)>new Date()))" size="sm" :disabled="busy" @click="pay(order)">{{checkoutEnvironment==='test'?'Probar checkout':'Pagar con Wompi'}}</UiButton>
    <UiButton v-if="order.status==='PENDING'&&(!checkoutFor(order.id)||checkoutFor(order.id)?.environment==='test'||checkoutFor(order.id)?.resolution==='NOT_PAID')" size="sm" variant="secondary" :disabled="busy" @click="cancel(order)">Cancelar</UiButton>
   </div>
   <PaymentReconcile v-if="reconciliationEnabled&&checkoutFor(order.id)" :key="workspaceId+':'+order.id" :workspace-id="workspaceId" :order-id="order.id" :transaction-known="checkoutFor(order.id)?.transactionKnown??false" :initial-id="returnOrder===order.id?safeReturnId:''" @updated="load"/>
  </div>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </UiCard>
</template>
