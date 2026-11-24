<script setup lang="ts">
import {onMounted,ref,watch,computed} from 'vue';
import {CreditCard,RefreshCw} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
type Code='STARTER'|'PRO'|'ACADEMY';
type Limits={students:number;teachers:number;storageBytes:number;aiDailyAttempts:number};
type Summary={plan:Code;assignedPlan:Code;validUntil:string|null;limits:Limits;usage:Limits;enforced:boolean;operationalAiDailyLimit:number};
const props=defineProps<{workspaceId:string}>();
const summary=ref<Summary|null>(null),loading=ref(false),error=ref('');
let version=0;
const metrics=computed(()=>{
 const s=summary.value;if(!s)return [];
 return [{name:'Alumnos',used:s.usage.students,max:s.limits.students},{name:'Profesores',used:s.usage.teachers,max:s.limits.teachers},{name:'Archivos (MiB)',used:Number((s.usage.storageBytes/1048576).toFixed(2)),max:s.limits.storageBytes/1048576},{name:'IA hoy (UTC)',used:s.usage.aiDailyAttempts,max:s.operationalAiDailyLimit}];
});
async function load(){
 const n=++version,w=props.workspaceId;loading.value=true;summary.value=null;error.value='';
 try{const s=await apiJson<Summary>(workspacePath(w,'/saas-plan'));if(n===version&&w===props.workspaceId)summary.value=s;}
 catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo consultar el plan.';}
 finally{if(n===version)loading.value=false;}
}
watch(()=>props.workspaceId,()=>void load());onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><CreditCard :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Plan de AcademyOS</h2><p class="text-xs text-muted">Capacidad y vigencia de tu espacio educativo.</p></div></div></template>
  <UiButton size="sm" variant="ghost" :disabled="loading" @click="load"><RefreshCw :size="14"/> Actualizar</UiButton>
  <p v-if="loading" class="text-xs text-muted">Consultando plan…</p>
  <template v-if="summary">
   <p class="text-2xl font-extrabold">{{summary.plan}}</p>
   <p v-if="summary.validUntil" class="text-xs text-muted">Asignación {{summary.assignedPlan}} · vence {{new Date(summary.validUntil).toLocaleDateString('es-CO',{timeZone:'UTC'})}} UTC</p>
   <UiAlert v-if="!summary.enforced" tone="warning">Cuotas comerciales en modo informativo. La IA conserva un límite operativo de 10 intentos diarios compartidos.</UiAlert>
   <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div v-for="item in metrics" :key="item.name" class="rounded-xl border border-outline p-3">
     <p class="text-xs text-muted">{{item.name}}</p><p class="text-lg font-bold">{{item.used}} / {{item.max}}</p><progress class="w-full accent-violet-600" :value="Math.min(item.used,item.max)" :max="item.max" :aria-label="item.name"/>
    </div>
   </div>
   <p class="text-xs text-muted">Los intentos de IA incluyen los fallidos y pendientes; no representan tokens ni dinero. Se reinician a medianoche UTC. Los planes manuales no representan suscripciones cobradas.</p>
  </template>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert>
 </UiCard>
</template>
