<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {CreditCard,RefreshCw} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson} from '../shared/api-client';
type Order={id:string;plan:string;interval:string;amountCOP:number;status:string;expiresAt:string;paidAt:string|null;periodStart:string|null;periodEnd:string|null;createdAt:string;paymentReference:string|null;resolutionNote:string|null};
const props=defineProps<{workspaceId:string}>();
const emit=defineEmits<{updated:[workspaceId:string,order:Order]}>();
const rows=ref<Order[]>([]),selected=ref<Order|null>(null),enabled=ref(false),loading=ref(false),busy=ref(false),more=ref(false),error=ref(''),notice=ref('');
const action=ref<'confirm'|'reject'>('confirm'),reference=ref(''),amount=ref<number|null>(null),note=ref(''),confirmed=ref(false);
let version=0;
const path=(w:string)=>'/api/v1/platform/academies/'+encodeURIComponent(w)+'/billing';
const money=(v:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(v);
const date=(v:string)=>new Date(v).toLocaleString('es-CO',{timeZone:'UTC'});
const expired=(o:Order)=>new Date(o.expiresAt)<=new Date();
function choose(o:Order){selected.value=o;action.value=enabled.value&&!expired(o)?'confirm':'reject';reference.value='';amount.value=null;note.value='';confirmed.value=false;}
async function load(append=false){
 const w=props.workspaceId,n=++version,cursor=append?rows.value.at(-1)?.id:null;loading.value=true;error.value='';
 if(!append){rows.value=[];more.value=false;enabled.value=false;}
 try{const data=await apiJson<{enabled:boolean;orders:Order[]}>(path(w)+(cursor?'?after='+encodeURIComponent(cursor):''));if(n===version&&w===props.workspaceId){enabled.value=data.enabled;rows.value=append?[...rows.value,...data.orders]:data.orders;more.value=data.orders.length===50;}}
 catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo consultar la facturación.';}
 finally{if(n===version)loading.value=false;}
}
async function review(){
 const o=selected.value,w=props.workspaceId;if(!o||busy.value||note.value.trim().length<6)return;
 if(action.value==='confirm'&&(!enabled.value||expired(o)||!confirmed.value||amount.value!==o.amountCOP||reference.value.trim().length<4))return;
 if(!window.confirm(action.value==='confirm'?'¿Registrar el pago externo ya comprobado y activar el periodo? No se realizará ningún cobro.':'¿Rechazar la solicitud? No se realizará devolución automática.'))return;
 busy.value=true;error.value='';notice.value='';
 try{const result=await apiJson<Order>(path(w)+'/'+encodeURIComponent(o.id)+'/review','POST',action.value==='confirm'?{action:'confirm',amountCOP:amount.value,paymentReference:reference.value,note:note.value,confirmedExternalPayment:true}:{action:'reject',note:note.value});if(w===props.workspaceId){selected.value=null;await load();notice.value='Solicitud resuelta y auditada.';emit('updated',w,result);}}
 catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo registrar la operación.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{selected.value=null;notice.value='';void load();});onMounted(()=>void load());
</script>
<template>
 <UiCard>
  <template #header><div class="flex items-center gap-2"><CreditCard :size="19" class="text-brand"/><h2 class="font-extrabold">Facturación AcademyOS</h2></div></template>
  <UiAlert tone="warning">Confirma únicamente pagos de la plataforma comprobados fuera del sistema. No son pagos de los alumnos. Las solicitudes vencidas requieren conciliación externa.</UiAlert>
  <UiButton size="sm" variant="secondary" :disabled="loading||busy" @click="load()"><RefreshCw :size="14"/> Actualizar</UiButton>
  <p v-if="loading" role="status" class="text-xs text-muted">Consultando…</p>
  <p v-else-if="!rows.length" class="text-xs text-muted">No hay solicitudes de esta academia.</p>
  <article v-for="o in rows" :key="o.id" class="space-y-1 rounded-xl border border-outline p-3">
   <p class="text-sm font-bold">{{o.plan}} · {{o.interval==='YEARLY'?'Anual':'Mensual'}}</p>
   <p class="text-xs text-muted">{{money(o.amountCOP)}} · {{o.status==='PENDING'&&expired(o)?'VENCIDA':o.status}}</p>
   <p v-if="o.periodStart&&o.periodEnd" class="text-xs">Periodo {{date(o.periodStart)}} — {{date(o.periodEnd)}} UTC</p>
   <p v-if="o.paymentReference" class="break-all text-xs text-muted">Referencia: {{o.paymentReference}}</p>
   <p v-if="o.resolutionNote" class="text-xs text-muted">{{o.resolutionNote}}</p>
   <UiButton v-if="o.status==='PENDING'" size="sm" variant="secondary" :disabled="busy" @click="choose(o)">Revisar</UiButton>
  </article>
  <UiButton v-if="more" size="sm" variant="secondary" :disabled="busy||loading" @click="load(true)">Cargar más</UiButton>
  <form v-if="selected" class="space-y-3 rounded-xl border border-outline p-3" @submit.prevent="review">
   <p class="text-sm font-bold">{{selected.plan}} · {{money(selected.amountCOP)}}</p>
   <label class="block text-xs font-semibold">Acción<select v-model="action" class="mt-1 w-full rounded-lg border border-outline bg-surface p-2"><option v-if="enabled&&!expired(selected)" value="confirm">Confirmar pago externo</option><option value="reject">Rechazar</option></select></label>
   <template v-if="action==='confirm'"><label class="block text-xs font-semibold">Importe COP<input v-model.number="amount" type="number" min="1" step="1" required class="mt-1 w-full rounded-lg border border-outline bg-surface p-2"/></label><label class="block text-xs font-semibold">Referencia comprobada<input v-model="reference" required minlength="4" maxlength="120" class="mt-1 w-full rounded-lg border border-outline bg-surface p-2"/></label><label class="flex gap-2 text-xs"><input v-model="confirmed" type="checkbox" required/> El pago fue confirmado externamente.</label></template>
   <label class="block text-xs font-semibold">Motivo<textarea v-model="note" required minlength="6" maxlength="300" class="mt-1 w-full rounded-lg border border-outline bg-surface p-2"/></label>
   <div class="flex gap-2"><UiButton type="submit" :disabled="busy||note.trim().length<6">Resolver</UiButton><UiButton type="button" variant="secondary" :disabled="busy" @click="selected=null">Cerrar</UiButton></div>
  </form>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </UiCard>
</template>
