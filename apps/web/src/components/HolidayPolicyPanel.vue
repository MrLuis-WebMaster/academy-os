<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {CalendarDays,ShieldCheck} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard,UiSwitch} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Holiday={date:string;name:string;country:'CO'};
type Settings={holidayCountry:'CO'|'NONE';avoidPublicHolidays:boolean;timezone:string};
type CalendarResponse=Settings&{year:number;holidays:Holiday[]};
const props=defineProps<{workspaceId:string;editable:boolean}>();
const policy=ref<Settings|null>(null),country=ref<'CO'|'NONE'>('CO');
const avoid=ref(false),holidays=ref<Holiday[]>([]);
const loading=ref(true),saving=ref(false),error=ref(''),notice=ref('');
let requestVersion=0;
function api<T>(workspaceId:string,suffix:string,method='GET',body?:unknown){
 return apiJson<T>(workspacePath(workspaceId,'/scheduling'+suffix),method,body);
}
async function refresh(){
 const workspaceId=props.workspaceId,version=++requestVersion;
 loading.value=true;error.value='';policy.value=null;holidays.value=[];
 try{
  const current=new Date().getFullYear();
  const [config,calendar,nextYear]=await Promise.all([
   api<Settings>(workspaceId,'/holiday-settings'),
   api<CalendarResponse>(workspaceId,'/holidays?year='+current),
   api<CalendarResponse>(workspaceId,'/holidays?year='+(current+1)),
  ]);
  if(version!==requestVersion||workspaceId!==props.workspaceId)return;
  policy.value=config;
  country.value=config.holidayCountry;
  avoid.value=config.avoidPublicHolidays;
  const today=new Date();
  const dateKey=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+
   '-'+String(today.getDate()).padStart(2,'0');
  holidays.value=[...calendar.holidays,...nextYear.holidays].filter(item=>item.date>=dateKey).slice(0,10);
 }catch(e){
  if(version===requestVersion&&workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo cargar el calendario de festivos.';
  }
 }finally{if(version===requestVersion)loading.value=false;}
}
async function save(){
 if(saving.value||!props.editable)return;
 const workspaceId=props.workspaceId;
 if(country.value==='NONE'&&avoid.value){
  error.value='Selecciona un país disponible o desactiva el bloqueo de festivos.';
  return;
 }
 saving.value=true;notice.value='';error.value='';
 try{
  await api<Settings>(workspaceId,'/holiday-settings','PATCH',{
   holidayCountry:country.value,avoidPublicHolidays:avoid.value,
  });
  if(workspaceId!==props.workspaceId)return;
  await refresh();
  if(workspaceId===props.workspaceId){
   notice.value='Política de festivos guardada. Las clases ya programadas no se modificaron.';
  }
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo actualizar la política.';
  }
 }finally{saving.value=false;}
}
const effectiveLabel=computed(()=>
 policy.value?.avoidPublicHolidays?'Bloqueo automático activado':'Modo informativo, sin bloqueo',
);
watch(()=>props.workspaceId,()=>{++requestVersion;saving.value=false;notice.value='';void refresh();});
onMounted(()=>void refresh());
</script>
<template>
 <UiCard class="mt-6">
  <template #header>
   <div class="flex items-center gap-3"><CalendarDays :size="22" class="text-brand"/><div>
    <h2 class="text-lg font-extrabold">Festivos y calendario académico</h2>
    <p class="mt-1 text-xs text-muted">Consulta feriados nacionales y, si lo deseas, impide crear o mover clases a esos días.</p>
   </div></div>
  </template>
  <p v-if="loading" class="text-xs text-muted">Cargando calendario…</p>
  <div v-else-if="policy" class="space-y-4">
   <div class="flex flex-wrap gap-4">
    <label class="text-xs font-semibold">País del calendario
     <select v-model="country" :disabled="!editable" class="mt-2 block w-full rounded-xl border border-outline bg-surface px-4 py-3 text-sm">
      <option value="CO">Colombia (actualización legal 2026)</option>
      <option value="NONE">Sin calendario nacional</option>
     </select>
    </label>
    <div class="flex flex-col justify-end gap-2">
     <UiSwitch v-model="avoid" :disabled="!editable || country==='NONE'" label="Evitar nuevas clases en días festivos"/>
     <p class="flex items-center gap-1 text-xs text-muted"><ShieldCheck :size="13"/> {{effectiveLabel}}</p>
    </div>
   </div>
   <p class="text-xs text-muted">Zona horaria de la academia: {{policy.timezone}}. La restricción se aplica a clases nuevas y reprogramaciones, sin cancelar las existentes. Otros países se incorporarán con reglas verificadas.</p>
   <UiButton v-if="editable" size="sm" :disabled="saving" :loading="saving" @click="save">Guardar política</UiButton>
   <div>
    <h3 class="text-sm font-bold">Próximos festivos nacionales</h3>
    <div v-if="holidays.length" class="mt-3 grid gap-2 md:grid-cols-2">
     <div v-for="holiday in holidays" :key="holiday.date" class="flex items-start gap-3 rounded-xl border border-outline p-3">
      <span class="rounded-lg bg-brand-soft px-2 py-1 text-xs font-bold text-brand">{{holiday.date}}</span>
      <span class="text-xs">{{holiday.name}}</span>
     </div>
    </div>
    <p v-else class="mt-2 text-xs text-muted">No hay festivos calculados para el calendario seleccionado.</p>
   </div>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-4">{{notice}}</UiAlert>
 </UiCard>
</template>
