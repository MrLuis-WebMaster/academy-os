<script setup lang="ts">
import {ref,onMounted,watch,computed} from 'vue';
import {Inbox,RefreshCw} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
type EventRow={id:string;environment:string;transactionId:string;signedStatus:string;state:string;attempts:number;resolution:string|null;lastErrorCode:string|null;createdAt:string;processedAt:string|null;nextAttemptAt:string};
const props=defineProps<{workspaceId:string}>();
const rows=ref<EventRow[]>([]),loading=ref(false),busy=ref(false),hasMore=ref(false),error=ref(''),notice=ref(''),filter=ref('ALL');
let version=0;
const visible=computed(()=>rows.value.filter(x=>filter.value==='ALL'||x.state===filter.value));
const labels:Record<string,string>={QUEUED:'En cola',DONE:'Procesado',IGNORED:'Sin orden asociada',REVIEW:'Requiere revisión',FAILED:'Intentos agotados'};
const path=(w:string)=>workspacePath(w,'/payment-events');
async function load(append=false){
 if(loading.value&&append)return;
 const w=props.workspaceId,n=++version,cursor=append?rows.value.at(-1)?.id:null;
 loading.value=true;error.value='';
 if(!append){rows.value=[];hasMore.value=false;}
 try{
  const result=await apiJson<EventRow[]>(path(w)+(cursor?'?after='+encodeURIComponent(cursor):''));
  if(n===version&&w===props.workspaceId){rows.value=append?[...rows.value,...result]:result;hasMore.value=result.length===50;}
 }catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudieron consultar los eventos.';}
 finally{if(n===version)loading.value=false;}
}
async function retry(row:EventRow){
 if(busy.value||row.state!=='FAILED'||!window.confirm('¿Volver a consultar esta transacción con Wompi? No se realizará un cobro.'))return;
 const w=props.workspaceId;busy.value=true;error.value='';notice.value='';
 try{
  await apiJson(path(w)+'/'+encodeURIComponent(row.id)+'/retry','POST');
  if(w!==props.workspaceId)return;
  await load();if(w===props.workspaceId)notice.value='Evento devuelto a la cola. El worker debe estar activo.';
 }catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo reintentar.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{notice.value='';filter.value='ALL';void load();});onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><Inbox :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Eventos de pagos</h2><p class="text-xs text-muted">Notificaciones firmadas guardadas para procesamiento y recuperación.</p></div></div></template>
  <div class="flex flex-wrap items-end gap-3">
   <label class="text-xs font-semibold">Estado (registros cargados)<select v-model="filter" class="mt-1 block rounded-lg border border-outline bg-surface p-2"><option value="ALL">Todos</option><option v-for="(label,state) in labels" :key="state" :value="state">{{label}}</option></select></label>
   <UiButton size="sm" variant="secondary" :disabled="loading||busy" @click="load()"><RefreshCw :size="14"/> Actualizar</UiButton>
  </div>
  <p v-if="loading" role="status" class="text-xs text-muted">Consultando eventos…</p>
  <p v-else-if="!visible.length" class="text-xs text-muted">No hay eventos en esta vista. La recepción durable requiere activación en el servidor.</p>
  <article v-for="row in visible" :key="row.id" class="rounded-xl border border-outline p-3 space-y-1">
   <div class="flex flex-wrap justify-between gap-2"><p class="text-sm font-bold">{{labels[row.state]||row.state}}</p><span class="text-xs text-muted">{{row.environment==='test'?'Sandbox':'Producción'}} · {{row.attempts}} intentos</span></div>
   <p class="break-all text-xs text-muted">Transacción {{row.transactionId}} · evento {{row.signedStatus}}</p>
   <p class="text-xs text-muted">Recibido {{new Date(row.createdAt).toLocaleString('es-CO')}}</p>
   <p v-if="row.state==='QUEUED'" class="text-xs text-muted">Próxima revisión: {{new Date(row.nextAttemptAt).toLocaleString('es-CO')}}</p>
   <p v-if="row.resolution" class="text-xs">Resultado: {{row.resolution}}</p>
   <p v-if="row.lastErrorCode" class="text-xs text-warning">{{row.lastErrorCode==='SIGNED_TRANSACTION_MISMATCH'?'El importe o ID no coincide con la verificación. Revisa en Wompi.':'No se pudo completar la consulta al proveedor.'}}</p>
   <UiButton v-if="row.state==='FAILED'" size="sm" variant="secondary" :disabled="busy||loading" @click="retry(row)">Reintentar verificación</UiButton>
  </article>
  <UiButton v-if="hasMore" size="sm" variant="secondary" :disabled="loading||busy" @click="load(true)">Cargar más</UiButton>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </UiCard>
</template>
