<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {CreditCard,RefreshCw} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
type Code='STARTER'|'PRO'|'ACADEMY';
type Limits={students:number;teachers:number;storageBytes:number};
type Assignment={plan:Code;validUntil:string|null};
type Summary={plan:Code;assignedPlan:Code;validUntil:string|null;limits:Limits;usage:Limits;enforced:boolean;catalog:Record<Code,Limits>};
type Academy={id:string;name:string;slug:string;assignment:Assignment|null};
const props=defineProps<{workspaceId:string}>();
const summary=ref<Summary|null>(null),operator=ref(false),academies=ref<Academy[]>([]),loading=ref(false),busy=ref(false),error=ref(''),notice=ref('');
const selected=ref(''),plan=ref<Code>('STARTER'),expiration=ref(''),reason=ref('');
let version=0;
const mib=(v:number)=>(v/1048576).toFixed(1);
async function load(){
 const n=++version,w=props.workspaceId;loading.value=true;summary.value=null;operator.value=false;academies.value=[];error.value='';
 try{
  const [s,a]=await Promise.all([apiJson<Summary>(workspacePath(w,'/saas-plan')),apiJson<{operator:boolean}>('/api/v1/platform/access')]);
  if(n!==version||w!==props.workspaceId)return;
  summary.value=s;operator.value=a.operator;
  if(a.operator){const rows=await apiJson<Academy[]>('/api/v1/platform/academies');if(n===version)academies.value=rows;}
 }catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo consultar el plan.';}
 finally{if(n===version)loading.value=false;}
}
async function more(){
 const cursor=academies.value.at(-1)?.id;if(!cursor||busy.value)return;
 const n=version;busy.value=true;
 try{const rows=await apiJson<Academy[]>('/api/v1/platform/academies?after='+encodeURIComponent(cursor));if(n===version){academies.value.push(...rows);if(!rows.length)notice.value='No hay más academias.';}}
 catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo continuar.';}finally{busy.value=false;}
}
async function assign(){
 if(!operator.value||!selected.value||busy.value||reason.value.trim().length<6)return;
 const w=props.workspaceId,id=selected.value;
 const until=expiration.value?new Date(expiration.value+'T23:59:59Z'):null;
 if(plan.value!=='STARTER'&&(!until||until<=new Date())){error.value='Indica una fecha de vencimiento futura.';return;}
 if(!window.confirm('¿Asignar este plan a la academia seleccionada? No se realizará ningún cobro.'))return;
 busy.value=true;error.value='';notice.value='';
 try{
  await apiJson('/api/v1/platform/academies/'+encodeURIComponent(id)+'/plan','PATCH',{plan:plan.value,validUntil:until?.toISOString()??null,reason:reason.value});
  if(w!==props.workspaceId)return;
  reason.value='';await load();notice.value='Plan asignado y auditado.';
 }catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo asignar el plan.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{selected.value='';reason.value='';notice.value='';void load();});onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><CreditCard :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Plan de AcademyOS</h2><p class="text-xs text-muted">Capacidad y vigencia de tu espacio educativo.</p></div></div></template>
  <UiButton size="sm" variant="ghost" :disabled="loading||busy" @click="load"><RefreshCw :size="14"/> Actualizar</UiButton>
  <p v-if="loading" class="text-xs text-muted">Consultando plan…</p>
  <template v-if="summary">
   <p class="text-2xl font-extrabold">{{summary.plan}}</p>
   <p v-if="summary.validUntil" class="text-xs text-muted">Asignación {{summary.assignedPlan}} · vence {{new Date(summary.validUntil).toLocaleDateString('es-CO',{timeZone:'UTC'})}} UTC</p>
   <UiAlert v-if="!summary.enforced" tone="warning">Cuotas comerciales todavía en modo informativo; los límites operativos de seguridad siguen vigentes.</UiAlert>
   <div class="grid gap-3 sm:grid-cols-3">
    <div v-for="item in [{name:'Alumnos',used:summary.usage.students,max:summary.limits.students},{name:'Profesores',used:summary.usage.teachers,max:summary.limits.teachers},{name:'Archivos (MiB)',used:Number(mib(summary.usage.storageBytes)),max:Number(mib(summary.limits.storageBytes))}]" :key="item.name" class="rounded-xl border border-outline p-3">
     <p class="text-xs text-muted">{{item.name}}</p><p class="text-lg font-bold">{{item.used}} / {{item.max}}</p><progress class="w-full accent-violet-600" :value="Math.min(item.used,item.max)" :max="item.max" :aria-label="item.name"/>
    </div>
   </div>
   <p class="text-xs text-muted">Los planes asignados manualmente no representan una suscripción cobrada ni una renovación automática.</p>
  </template>
  <form v-if="operator" class="mt-4 space-y-3 rounded-xl border border-outline p-4" @submit.prevent="assign">
   <h3 class="text-sm font-extrabold">Administración de plataforma</h3><p class="text-xs text-muted">Acceso exclusivo de operadores autorizados.</p>
   <label class="block text-xs font-semibold">Academia<select v-model="selected" required class="mt-2 w-full rounded-lg border border-outline bg-surface p-2"><option value="">Seleccionar</option><option v-for="a in academies" :key="a.id" :value="a.id">{{a.name}} · {{a.slug}} · {{a.assignment?.plan||'STARTER'}}</option></select></label>
   <UiButton type="button" size="sm" variant="secondary" :disabled="busy||!academies.length" @click="more">Cargar más academias</UiButton>
   <label class="block text-xs font-semibold">Plan<select v-model="plan" class="mt-2 w-full rounded-lg border border-outline bg-surface p-2"><option>STARTER</option><option>PRO</option><option>ACADEMY</option></select></label>
   <label class="block text-xs font-semibold">Vencimiento UTC<input v-model="expiration" type="date" :required="plan!=='STARTER'" class="mt-2 w-full rounded-lg border border-outline bg-surface p-2"/></label>
   <label class="block text-xs font-semibold">Motivo<textarea v-model="reason" required minlength="6" maxlength="300" class="mt-2 w-full rounded-lg border border-outline bg-surface p-2"/></label>
   <UiButton type="submit" :disabled="busy||!selected||reason.trim().length<6">Asignar plan</UiButton>
  </form>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </UiCard>
</template>
