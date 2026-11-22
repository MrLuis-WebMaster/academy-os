<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {CalendarOff,Plus,Trash2,RefreshCcw} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard,UiField,UiInput,UiSelect} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Teacher={id:string;user:{name:string}};
type TimeOff={id:string;teacherProfileId:string;startsAt:string;endsAt:string;reason:string};
const props=defineProps<{workspaceId:string;teachers:Teacher[]}>();
const exceptions=ref<TimeOff[]>([]),teacherId=ref(''),date=ref(''),startTime=ref('09:00');
const endDate=ref(''),endTime=ref('18:00'),reason=ref('');
const busy=ref(false),loading=ref(false),error=ref(''),message=ref('');
function endpoint(path=''){return workspacePath(props.workspaceId,'/availability/exceptions'+path);}
function teacherName(id:string){return props.teachers.find(t=>t.id===id)?.user.name??'Profesor';}
async function refresh(){
 const workspace=props.workspaceId;
 loading.value=true;error.value='';
 try{
  const rows=await apiJson<TimeOff[]>(endpoint());
  if(workspace===props.workspaceId)exceptions.value=rows;
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo consultar el calendario de ausencias.';}
 finally{if(workspace===props.workspaceId)loading.value=false;}
}
async function create(){
 busy.value=true;error.value='';message.value='';
 try{
  const start=new Date(date.value+'T'+startTime.value+':00');
  const end=new Date(endDate.value+'T'+endTime.value+':00');
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)
   throw Error('Elige un inicio y final válidos.');
  await apiJson(endpoint(),'POST',{
   teacherProfileId:teacherId.value,startsAt:start.toISOString(),endsAt:end.toISOString(),reason:reason.value,
  });
  await refresh();
  message.value='Ausencia registrada. Las clases nuevas y reprogramaciones respetarán este bloqueo.';
  reason.value='';
 }catch(e){error.value=e instanceof Error?e.message:'No fue posible registrar la ausencia.';}
 finally{busy.value=false;}
}
async function remove(row:TimeOff){
 if(!window.confirm('¿Quitar este bloqueo? No se modifica ninguna clase previamente confirmada.'))return;
 busy.value=true;error.value='';message.value='';
 try{
  await apiJson(endpoint('/'+encodeURIComponent(row.id)),'DELETE');
  await refresh();message.value='Bloqueo eliminado.';
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo quitar el bloqueo.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{teacherId.value='';exceptions.value=[];void refresh();});
onMounted(refresh);
</script>
<template>
 <UiCard class="mt-6">
  <template #header>
   <div class="flex items-center gap-3">
    <CalendarOff :size="22" class="text-brand"/>
    <div>
     <h2 class="text-lg font-extrabold">Días libres y excepciones</h2>
     <p class="mt-1 text-xs text-muted">Vacaciones, festivos o ausencias del profesor. Una ausencia no puede superponerse con una clase confirmada.</p>
    </div>
   </div>
  </template>
  <form class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" @submit.prevent="create">
   <UiField for="off-teacher" label="Profesor" required>
    <UiSelect id="off-teacher" v-model="teacherId" required>
     <option value="">Elegir profesor</option>
     <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{teacher.user.name}}</option>
    </UiSelect>
   </UiField>
   <UiField for="off-date" label="Desde (fecha)" required><UiInput id="off-date" v-model="date" type="date" required/></UiField>
   <UiField for="off-start" label="Desde (hora)" required><UiInput id="off-start" v-model="startTime" type="time" required/></UiField>
   <UiField for="off-end-date" label="Hasta (fecha)" required><UiInput id="off-end-date" v-model="endDate" type="date" required/></UiField>
   <UiField for="off-end-time" label="Hasta (hora)" required><UiInput id="off-end-time" v-model="endTime" type="time" required/></UiField>
   <UiField for="off-reason" label="Motivo" required><UiInput id="off-reason" v-model="reason" :minlength="3" :maxlength="240" required placeholder="Ej. Vacaciones, festivo, cita personal"/></UiField>
   <div class="lg:col-span-3"><UiButton :loading="busy" :disabled="!teacherId" type="submit"><Plus :size="15"/> Bloquear disponibilidad</UiButton></div>
  </form>
  <p class="mt-3 text-xs text-muted">Se usan las horas del dispositivo. Puedes bloquear desde 15 minutos hasta 30 días.</p>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="message" tone="success" class="mt-4">{{message}}</UiAlert>
  <div class="mt-5 border-t border-outline pt-4">
   <div class="flex items-center justify-between">
    <p class="text-sm font-bold">Ausencias programadas</p>
    <UiButton variant="ghost" size="sm" :disabled="loading" @click="refresh"><RefreshCcw :size="15"/> Actualizar</UiButton>
   </div>
   <p v-if="loading" class="mt-3 text-xs text-muted">Cargando ausencias...</p>
   <div v-else class="mt-3 space-y-2">
    <div v-for="row in exceptions" :key="row.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-3">
     <div>
      <p class="text-sm font-bold">{{teacherName(row.teacherProfileId)}}</p>
      <p class="mt-1 text-xs text-muted">{{new Date(row.startsAt).toLocaleString('es-CO')}} — {{new Date(row.endsAt).toLocaleString('es-CO')}}</p>
      <p class="mt-1 text-xs text-muted">{{row.reason}}</p>
     </div>
     <UiButton size="sm" variant="danger" :disabled="busy" @click="remove(row)"><Trash2 :size="14"/> Quitar</UiButton>
    </div>
    <p v-if="!exceptions.length" class="text-xs text-muted">Todavía no hay ausencias registradas.</p>
   </div>
  </div>
 </UiCard>
</template>
