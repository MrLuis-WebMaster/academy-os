<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import PaymentReconcile from './PaymentReconcile.vue';
import {ClipboardCheck,RefreshCw} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
type Order={id:string;title:string;priceCOP:number;credits:number;validDays:number;status:string;createdAt:string;student:{name:string};paymentReference:string|null;reviewNote:string|null;reviewer:{name:string}|null;checkout?:{environment:string;providerStatus:string;resolution:string;reference:string;providerTransactionId:string|null}|null};
const props=defineProps<{workspaceId:string}>();
const orders=ref<Order[]>([]),loading=ref(false),busy=ref(false),error=ref(''),notice=ref('');
const selected=ref<Order|null>(null),action=ref<'fulfill'|'reject'>('fulfill'),reference=ref(''),amount=ref<number|null>(null),note=ref(''),verified=ref(false);
let version=0;
const path=(w:string,suffix='')=>workspacePath(w,'/package-orders'+suffix);
const money=(v:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(v);
const labels:Record<string,string>={PENDING:'Pendiente',FULFILLED:'Entregada',CANCELLED:'Cancelada',REJECTED:'Rechazada'};
function choose(row:Order){selected.value=row;action.value=row.checkout?'reject':'fulfill';reference.value='';amount.value=null;note.value='';verified.value=false;}
async function load(){
 const w=props.workspaceId,n=++version;loading.value=true;orders.value=[];error.value='';
 try{const rows=await apiJson<Order[]>(path(w));if(n===version&&w===props.workspaceId)orders.value=rows;}
 catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudieron consultar las solicitudes.';}
 finally{if(n===version)loading.value=false;}
}
async function review(){
 const row=selected.value,w=props.workspaceId;
 if(!row||busy.value||note.value.trim().length<6)return;
 if(action.value==='fulfill'&&(!verified.value||amount.value!==row.priceCOP||reference.value.trim().length<4))return;
 if(!window.confirm(action.value==='fulfill'?'¿Registrar el pago externo comprobado y entregar los créditos? AcademyOS no verifica la transacción en el banco.':'¿Rechazar esta solicitud? No se devolverá dinero automáticamente.'))return;
 busy.value=true;error.value='';notice.value='';
 try{
  await apiJson(path(w,'/'+encodeURIComponent(row.id)+'/review'),'PATCH',action.value==='fulfill'?{action:'fulfill',amountCOP:amount.value,paymentReference:reference.value,note:note.value,confirmedExternalPayment:true}:{action:'reject',note:note.value});
  if(w!==props.workspaceId)return;
  selected.value=null;await load();if(w===props.workspaceId)notice.value='Solicitud resuelta y registrada.';
 }catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo resolver.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{selected.value=null;notice.value='';void load();});onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><ClipboardCheck :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Solicitudes de compra</h2><p class="mt-1 text-xs text-muted">Control de pagos externos y entrega de paquetes.</p></div></div></template>
  <UiAlert tone="warning">Comprueba el importe y la referencia directamente en el banco o proveedor. Wompi permite consultar la transacción; los pagos externos y los reembolsos siguen requiriendo revisión.</UiAlert>
  <UiButton size="sm" variant="ghost" :disabled="loading||busy" @click="load"><RefreshCw :size="14"/> Actualizar</UiButton>
  <p v-if="loading" class="text-xs text-muted">Consultando solicitudes…</p>
  <p v-else-if="!orders.length" class="text-xs text-muted">Sin solicitudes registradas.</p>
  <article v-for="row in orders" :key="row.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-3">
   <div><p class="text-sm font-bold">{{row.title}} · {{row.student.name}}</p><p class="text-xs text-muted">{{money(row.priceCOP)}} · {{row.credits}} créditos · {{labels[row.status]||row.status}}</p><p v-if="row.paymentReference" class="break-all text-xs text-muted">Referencia: {{row.paymentReference}} · {{row.reviewer?.name}}</p><p v-if="row.reviewNote" class="text-xs text-muted">{{row.reviewNote}}</p></div>
   <div v-if="row.checkout" class="text-xs text-muted"><p>Wompi · {{row.checkout.environment==='test'?'Pruebas':'Producción'}} · {{row.checkout.providerStatus}}</p><p class="break-all">{{row.checkout.resolution}} · {{row.checkout.reference}}</p><p v-if="row.checkout.providerTransactionId" class="break-all">Transacción: {{row.checkout.providerTransactionId}}</p><p v-if="row.checkout.resolution==='REVIEW_REQUIRED'" class="text-warning">Requiere conciliación externa. No asignar créditos manualmente.</p></div>
   <PaymentReconcile v-if="row.checkout" :key="workspaceId+':'+row.id" :workspace-id="workspaceId" :order-id="row.id" :transaction-known="Boolean(row.checkout.providerTransactionId)" @updated="load"/>
   <UiButton v-if="row.status==='PENDING'&&(!row.checkout||row.checkout.environment==='test'||row.checkout.resolution==='NOT_PAID')" size="sm" variant="secondary" :disabled="busy" @click="choose(row)">Revisar</UiButton>
  </article>
  <form v-if="selected" class="mt-4 space-y-3 rounded-xl border border-outline p-4" @submit.prevent="review">
   <h3 class="text-sm font-extrabold">{{selected.student.name}} · {{money(selected.priceCOP)}}</h3>
   <label class="block text-xs font-semibold">Acción<select v-model="action" class="mt-2 w-full rounded-lg border border-outline bg-surface p-2"><option v-if="!selected.checkout" value="fulfill">Registrar pago externo y entregar créditos</option><option value="reject">Rechazar solicitud</option></select></label>
   <template v-if="action==='fulfill'">
    <label class="block text-xs font-semibold">Referencia comprobada<input v-model="reference" required maxlength="120" class="mt-2 w-full rounded-lg border border-outline bg-surface p-2"/></label>
    <label class="block text-xs font-semibold">Importe recibido en COP<input v-model.number="amount" type="number" min="1" step="1" required class="mt-2 w-full rounded-lg border border-outline bg-surface p-2"/></label>
    <label class="flex items-center gap-2 text-xs"><input v-model="verified" type="checkbox" required/> Confirmo que he verificado el pago real fuera de AcademyOS.</label>
   </template>
   <label class="block text-xs font-semibold">Nota de revisión<textarea v-model="note" required minlength="6" maxlength="300" class="mt-2 w-full rounded-lg border border-outline bg-surface p-2"/></label>
   <div class="flex gap-2"><UiButton type="submit" :disabled="busy||note.trim().length<6||(action==='fulfill'&&(!verified||amount!==selected.priceCOP||reference.trim().length<4))">Resolver solicitud</UiButton><UiButton type="button" variant="secondary" :disabled="busy" @click="selected=null">Cerrar</UiButton></div>
  </form>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </UiCard>
</template>
