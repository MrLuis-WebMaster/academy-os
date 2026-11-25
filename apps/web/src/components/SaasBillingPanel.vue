<script setup lang="ts">
import {onMounted,ref,watch,computed} from 'vue';
import {CreditCard,RefreshCw} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
type Price={plan:'PRO'|'ACADEMY';interval:'MONTHLY'|'YEARLY';amountCOP:number};
type Order={id:string;plan:string;interval:string;amountCOP:number;status:string;expiresAt:string;paidAt:string|null;periodStart:string|null;periodEnd:string|null;createdAt:string;paymentReference:string|null;resolutionNote:string|null};
const props=defineProps<{workspaceId:string;canRequest:boolean}>();
const emit=defineEmits<{updated:[]}>();
const prices=ref<Price[]>([]),orders=ref<Order[]>([]),enabled=ref(false),loading=ref(false),busy=ref(false),more=ref(false),error=ref(''),notice=ref('');
const pending=computed(()=>orders.value.some(o=>o.status==='PENDING'&&new Date(o.expiresAt)>new Date()));
const keys=new Map<string,string>();
let version=0;
const path=(w:string)=>workspacePath(w,'/saas-billing');
const money=(v:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(v);
const interval=(v:string)=>v==='YEARLY'?'Anual':'Mensual';
const date=(v:string)=>new Date(v).toLocaleString('es-CO',{timeZone:'UTC'});
function state(o:Order){return o.status==='PENDING'&&new Date(o.expiresAt)<=new Date()?'Solicitud vencida':({PENDING:'Pendiente de revisión',PAID:'Pago registrado',REJECTED:'Rechazada',CANCELLED:'Cancelada'} as Record<string,string>)[o.status]??o.status;}
async function load(append=false){
 const w=props.workspaceId,n=++version,cursor=append?orders.value.at(-1)?.id:null;
 loading.value=true;error.value='';
 if(!append){orders.value=[];prices.value=[];enabled.value=false;more.value=false;}
 try{const data=await apiJson<{enabled:boolean;prices:Price[];orders:Order[]}>(path(w)+(cursor?'?after='+encodeURIComponent(cursor):''));if(n===version&&w===props.workspaceId){enabled.value=data.enabled;prices.value=data.prices;orders.value=append?[...orders.value,...data.orders]:data.orders;more.value=data.orders.length===50;}}
 catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo consultar facturación.';}
 finally{if(n===version)loading.value=false;}
}
async function request(price:Price){
 if(busy.value||pending.value||!props.canRequest||!enabled.value)return;
 if(!window.confirm('¿Solicitar '+price.plan+' '+interval(price.interval)+' por '+money(price.amountCOP)+'? No se realizará ningún cobro.'))return;
 const w=props.workspaceId,key=w+':'+price.plan+':'+price.interval+':'+price.amountCOP,requestId=keys.get(key)??crypto.randomUUID();keys.set(key,requestId);
 busy.value=true;error.value='';notice.value='';
 try{await apiJson(path(w),'POST',{plan:price.plan,interval:price.interval,expectedAmountCOP:price.amountCOP,requestId});keys.delete(key);if(w===props.workspaceId){await load();notice.value='Solicitud registrada. Coordina el pago externo con AcademyOS; la activación requiere confirmación.';}}
 catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo registrar.';}
 finally{busy.value=false;}
}
async function cancel(o:Order){
 if(busy.value||!props.canRequest||!window.confirm('¿Cancelar la solicitud? Si ya pagaste, contacta a AcademyOS antes de cancelar. No habrá devolución automática.'))return;
 const w=props.workspaceId;busy.value=true;error.value='';notice.value='';
 try{await apiJson(path(w)+'/'+encodeURIComponent(o.id)+'/cancel','POST');if(w===props.workspaceId){await load();notice.value='Solicitud cancelada.';}}
 catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo cancelar.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{notice.value='';void load();});onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><CreditCard :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Suscripción y facturación de AcademyOS</h2><p class="text-xs text-muted">Independiente de los pagos de tus alumnos.</p></div></div></template>
  <UiAlert tone="warning">Las solicitudes no realizan cobros ni renovaciones automáticas. Los periodos se activan al registrar un pago externo verificado por el equipo de AcademyOS.</UiAlert>
  <UiButton variant="secondary" size="sm" :disabled="loading||busy" @click="load();emit('updated')"><RefreshCw :size="14"/> Actualizar facturación</UiButton>
  <p v-if="loading" role="status" class="text-xs text-muted">Consultando…</p>
  <p v-else-if="!enabled||!prices.length" class="text-xs text-muted">Nuevas solicitudes no disponibles.</p>
  <div v-else class="grid gap-3 sm:grid-cols-2">
   <article v-for="price in prices" :key="price.plan+price.interval" class="space-y-2 rounded-xl border border-outline p-4">
    <p class="text-xs text-muted">{{interval(price.interval)}}</p><h3 class="font-extrabold">{{price.plan}}</h3><p class="text-xl font-extrabold">{{money(price.amountCOP)}}</p>
    <UiButton v-if="canRequest" size="sm" :disabled="busy||pending" @click="request(price)">Solicitar o renovar</UiButton>
   </article>
  </div>
  <h3 class="text-sm font-bold">Historial de solicitudes</h3>
  <p v-if="!loading&&!orders.length" class="text-xs text-muted">Sin solicitudes registradas.</p>
  <article v-for="o in orders" :key="o.id" class="space-y-1 rounded-xl border border-outline p-3">
   <div class="flex flex-wrap justify-between gap-2"><p class="text-sm font-bold">{{o.plan}} · {{interval(o.interval)}}</p><p class="text-xs font-semibold">{{state(o)}}</p></div>
   <p class="text-xs text-muted">{{money(o.amountCOP)}} · {{date(o.createdAt)}} UTC</p>
   <p v-if="o.periodStart&&o.periodEnd" class="text-xs">Periodo: {{date(o.periodStart)}} — {{date(o.periodEnd)}} UTC</p>
   <p v-if="o.status==='PENDING'" class="text-xs text-muted">Solicitud válida hasta {{date(o.expiresAt)}} UTC</p>
   <p v-if="o.paymentReference" class="break-all text-xs text-muted">Referencia: {{o.paymentReference}}</p>
   <p v-if="o.resolutionNote" class="text-xs text-muted">{{o.resolutionNote}}</p>
   <UiButton v-if="canRequest&&o.status==='PENDING'" variant="secondary" size="sm" :disabled="busy" @click="cancel(o)">Cancelar solicitud</UiButton>
  </article>
  <UiButton v-if="more" variant="secondary" size="sm" :disabled="loading||busy" @click="load(true)">Cargar más</UiButton>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </UiCard>
</template>
