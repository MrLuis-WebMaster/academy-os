<script setup lang="ts">
import {onMounted,ref,watch,computed} from 'vue';
import {ReceiptText,RefreshCw} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
type Entry={id:string;kind:string;actorUserId:string;note:string;amountCOP:number|null;externalReference:string|null;createdAt:string};
type Case={orderId:string;title:string;studentName:string;priceCOP:number;orderStatus:string;checkoutEnvironment:string|null;providerStatus:string|null;checkoutResolution:string|null;caseStatus:string|null;category:string|null;recordedRefundCOP:number;refundableCOP:number;entitlementRevoked:boolean|null;entries:Entry[]};
type Action='open'|'note'|'close'|'reopen'|'recordRefund';
const props=defineProps<{workspaceId:string}>();
const rows=ref<Case[]>([]),selected=ref<Case|null>(null),loading=ref(false),busy=ref(false),detailLoading=ref(false),more=ref(false),error=ref(''),notice=ref(''),filter=ref('ALL');
const action=ref<Action>('open'),category=ref('PAYMENT_REVIEW'),note=ref(''),amount=ref<number|null>(null),reference=ref(''),confirmed=ref(false);
const keys=new Map<string,string>();
let generation=0,detailVersion=0;
const path=(w:string)=>workspacePath(w,'/payment-cases');
const money=(value:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
const visible=computed(()=>rows.value.filter(x=>filter.value==='ALL'||(x.caseStatus??'NONE')===filter.value));
const actions=computed<Action[]>(()=>!selected.value?.caseStatus?['open']:selected.value.caseStatus==='CLOSED'?['reopen']:selected.value.refundableCOP>0?['note','recordRefund','close']:['note','close']);
const labels:Record<string,string>={OPEN:'Abierto',CLOSED:'Cerrado',REFUND:'Reembolso',DISPUTE:'Disputa',PAYMENT_REVIEW:'Revisión de pago',NOTE:'Nota',REFUND_RECORDED:'Reembolso registrado',CLOSE:'Cierre',REOPEN:'Reapertura'};
const actionLabels:Record<Action,string>={open:'Abrir expediente',note:'Añadir nota',close:'Cerrar expediente',reopen:'Reabrir expediente',recordRefund:'Registrar devolución externa'};
function reset(){action.value=actions.value[0]??'open';note.value='';amount.value=null;reference.value='';confirmed.value=false;}
async function load(append=false){
 const w=props.workspaceId,n=++generation,cursor=append?rows.value.at(-1)?.orderId:null;loading.value=true;error.value='';
 if(!append){rows.value=[];more.value=false;}
 try{const result=await apiJson<Case[]>(path(w)+(cursor?'?after='+encodeURIComponent(cursor):''));if(w===props.workspaceId&&n===generation){rows.value=append?[...rows.value,...result]:result;more.value=result.length===50;}}
 catch(e){if(n===generation)error.value=e instanceof Error?e.message:'No se pudo consultar expedientes.';}
 finally{if(n===generation)loading.value=false;}
}
async function choose(row:Case){
 const w=props.workspaceId,n=++detailVersion;detailLoading.value=true;selected.value=null;notice.value='';error.value='';
 try{const result=await apiJson<Case>(path(w)+'/'+encodeURIComponent(row.orderId));if(w===props.workspaceId&&n===detailVersion){selected.value=result;reset();}}
 catch(e){if(n===detailVersion)error.value=e instanceof Error?e.message:'No se pudo consultar el expediente.';}
 finally{if(n===detailVersion)detailLoading.value=false;}
}
async function submit(){
 const row=selected.value;if(!row||busy.value||note.value.trim().length<6)return;
 if(action.value==='recordRefund'&&(!confirmed.value||!amount.value||!Number.isSafeInteger(amount.value)||amount.value<1||amount.value>row.refundableCOP||reference.value.trim().length<4))return;
 const w=props.workspaceId,id=row.orderId;
 const body={action:action.value,note:note.value.trim(),...(action.value==='open'?{category:category.value}:action.value==='recordRefund'?{amountCOP:amount.value,externalReference:reference.value.trim(),confirmedExternalRefund:true}:{})};
 if(!window.confirm(action.value==='recordRefund'?'¿Registrar una devolución ya efectuada fuera de AcademyOS? Esto no envía dinero ni modifica créditos.':'¿Guardar esta acción en el historial del expediente?'))return;
 const key=w+':'+id+':'+JSON.stringify(body),requestId=keys.get(key)??crypto.randomUUID();keys.set(key,requestId);
 busy.value=true;error.value='';notice.value='';
 try{
  const result=await apiJson<Case>(path(w)+'/'+encodeURIComponent(id)+'/actions','POST',{...body,requestId});
  keys.delete(key);
  if(w!==props.workspaceId||selected.value?.orderId!==id)return;
  selected.value=result;const index=rows.value.findIndex(x=>x.orderId===id);if(index>=0)rows.value[index]=result;
  reset();notice.value='Acción registrada. No se realizó ningún movimiento de dinero.';
 }catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo registrar la acción.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{detailVersion++;selected.value=null;detailLoading.value=false;notice.value='';filter.value='ALL';reset();void load();});onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><ReceiptText :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Incidencias y devoluciones</h2><p class="text-xs text-muted">Revisión administrativa de compras y seguimiento de disputas.</p></div></div></template>
  <UiAlert tone="warning">Este registro no envía dinero, no confirma reembolsos con Wompi ni modifica créditos. Verifica las devoluciones en el proveedor antes de registrarlas. No incluyas datos bancarios, contraseñas o información de tarjeta en las notas.</UiAlert>
  <div class="flex flex-wrap gap-3 items-end"><label class="text-xs font-semibold">Estado (registros cargados)<select v-model="filter" class="mt-1 block rounded-lg border border-outline bg-surface p-2"><option value="ALL">Todos</option><option value="NONE">Sin expediente</option><option value="OPEN">Abiertos</option><option value="CLOSED">Cerrados</option></select></label><UiButton size="sm" variant="secondary" :disabled="loading||busy" @click="load()"><RefreshCw :size="14"/> Actualizar compras</UiButton></div>
  <p v-if="loading" role="status" class="text-xs text-muted">Consultando…</p>
  <p v-else-if="!visible.length" class="text-xs text-muted">No hay compras entregadas o con incidencias en esta página.</p>
  <div class="grid gap-4 lg:grid-cols-2">
   <div class="space-y-2">
    <button v-for="row in visible" :key="row.orderId" type="button" :disabled="busy" :aria-pressed="selected?.orderId===row.orderId" :class="selected?.orderId===row.orderId?'border-brand bg-brand-soft':'border-outline'" class="w-full rounded-xl border p-3 text-left" @click="choose(row)">
     <p class="text-sm font-bold">{{row.title}} · {{row.studentName}}</p><p class="text-xs text-muted">{{money(row.priceCOP)}} · {{row.caseStatus?labels[row.caseStatus]:'Sin expediente'}}</p><p v-if="row.recordedRefundCOP" class="text-xs text-muted">Devoluciones registradas: {{money(row.recordedRefundCOP)}}</p>
    </button>
    <UiButton v-if="more" size="sm" variant="secondary" :disabled="loading||busy" @click="load(true)">Cargar más</UiButton>
   </div>
   <div class="space-y-3">
    <p v-if="detailLoading" role="status" class="text-xs text-muted">Consultando expediente…</p>
    <template v-if="selected">
     <h3 class="text-sm font-extrabold">{{selected.title}} · {{selected.studentName}}</h3>
     <p class="text-xs text-muted">Compra {{selected.orderStatus}} · {{selected.checkoutEnvironment||'Pago externo'}} · {{selected.checkoutResolution||'Sin checkout'}}</p>
     <p class="text-xs">Registrado: {{money(selected.recordedRefundCOP)}} · Saldo máximo registrable: {{money(selected.refundableCOP)}}</p>
     <p class="text-xs text-muted">Paquete: {{selected.entitlementRevoked===null?'Sin asignación':selected.entitlementRevoked?'Revocado':'No revocado'}}. Gestiona sus créditos desde Paquetes de clases.</p>
     <form class="space-y-3 rounded-xl border border-outline p-3" @submit.prevent="submit">
      <label class="block text-xs font-semibold">Acción<select v-model="action" :disabled="busy" class="mt-1 w-full rounded-lg border border-outline bg-surface p-2"><option v-for="a in actions" :key="a" :value="a">{{actionLabels[a]}}</option></select></label>
      <label v-if="action==='open'" class="block text-xs font-semibold">Categoría<select v-model="category" class="mt-1 w-full rounded-lg border border-outline bg-surface p-2"><option value="PAYMENT_REVIEW">Revisión de pago</option><option value="REFUND">Reembolso</option><option value="DISPUTE">Disputa</option></select></label>
      <template v-if="action==='recordRefund'">
       <label class="block text-xs font-semibold">Monto devuelto COP<input v-model.number="amount" type="number" min="1" :max="selected.refundableCOP" step="1" required class="mt-1 w-full rounded-lg border border-outline bg-surface p-2"/></label>
       <label class="block text-xs font-semibold">Referencia de devolución<input v-model="reference" required minlength="4" maxlength="120" class="mt-1 w-full rounded-lg border border-outline bg-surface p-2"/></label>
       <label class="flex gap-2 text-xs"><input v-model="confirmed" type="checkbox" required/> Confirmo que la devolución ya fue efectuada externamente.</label>
      </template>
      <label class="block text-xs font-semibold">Motivo o nota<textarea v-model="note" required minlength="6" maxlength="500" class="mt-1 w-full rounded-lg border border-outline bg-surface p-2"/></label>
      <UiButton type="submit" :disabled="busy||note.trim().length<6">Guardar acción</UiButton>
     </form>
     <h3 class="text-sm font-bold">Últimos 100 movimientos</h3>
     <article v-for="entry in selected.entries" :key="entry.id" class="rounded-xl border border-outline p-3"><p class="text-xs font-bold">{{labels[entry.kind]||entry.kind}}<template v-if="entry.amountCOP!==null"> · {{money(entry.amountCOP)}}</template></p><p class="break-words text-xs">{{entry.note}}</p><p v-if="entry.externalReference" class="break-all text-xs text-muted">Referencia: {{entry.externalReference}}</p><p class="break-all text-xs text-muted">{{new Date(entry.createdAt).toLocaleString('es-CO')}} · {{entry.actorUserId}}</p></article>
    </template>
   </div>
  </div>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </UiCard>
</template>
