<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {CalendarRange,Plus,Trash2} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard,UiField,UiInput,UiSelect} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Teacher={id:string;user:{name:string}};
type Slot={id:string;teacherProfileId:string;dayOfWeek:number;startMinute:number;endMinute:number};
const props=defineProps<{workspaceId:string;teachers:Teacher[]}>();
const weekdays=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const slots=ref<Slot[]>([]),teacherProfileId=ref(''),dayOfWeek=ref(1);
const startTime=ref('09:00'),endTime=ref('17:00');
const loading=ref(false),busy=ref(false),error=ref(''),message=ref('');
function path(suffix:string){return workspacePath(props.workspaceId,'/availability'+suffix);}
function hhmm(minute:number){return String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');}
function teacherName(id:string){return props.teachers.find(t=>t.id===id)?.user.name??'Profesor';}
async function load(){
 loading.value=true;error.value='';
 try{slots.value=await apiJson<Slot[]>(path(''));}
 catch(e){error.value=e instanceof Error?e.message:'No pudimos cargar los horarios.';}
 finally{loading.value=false;}
}
async function create(){
 busy.value=true;error.value='';message.value='';
 try{
  await apiJson(path(''),'POST',{
   teacherProfileId:teacherProfileId.value,dayOfWeek:dayOfWeek.value,startTime:startTime.value,endTime:endTime.value,
  });
  await load();message.value='Horario semanal guardado. A partir de ahora se aplica al agendar o reprogramar clases.';
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo guardar el horario.';}
 finally{busy.value=false;}
}
async function remove(slot:Slot){
 if(!window.confirm('¿Eliminar esta disponibilidad semanal? No se cancelarán clases ya confirmadas.'))return;
 busy.value=true;error.value='';message.value='';
 try{await apiJson(path('/'+encodeURIComponent(slot.id)),'DELETE');await load();message.value='Franja eliminada.';}
 catch(e){error.value=e instanceof Error?e.message:'No se pudo eliminar.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{teacherProfileId.value='';load();});
onMounted(load);
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-2"><CalendarRange :size="21" class="text-brand"/><div>
    <h2 class="text-lg font-extrabold">Disponibilidad semanal</h2>
    <p class="mt-1 text-xs text-muted">Configura cuándo atiende cada profesor. Puedes crear varias franjas por día y dejar espacios para descansos.</p>
  </div></div></template>
  <form class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="create">
   <UiField for="avail-teacher" label="Profesor" required><UiSelect id="avail-teacher" v-model="teacherProfileId" required>
    <option value="">Seleccionar profesor</option><option v-for="t in teachers" :key="t.id" :value="t.id">{{t.user.name}}</option>
   </UiSelect></UiField>
   <UiField for="avail-weekday" label="Día" required><UiSelect id="avail-weekday" :model-value="dayOfWeek" @update:model-value="dayOfWeek=Number($event)">
    <option v-for="(day,index) in weekdays" :key="index" :value="index">{{day}}</option>
   </UiSelect></UiField>
   <UiField for="avail-start" label="Desde" required><UiInput id="avail-start" v-model="startTime" type="time" required/></UiField>
   <UiField for="avail-end" label="Hasta" required><UiInput id="avail-end" v-model="endTime" type="time" required/></UiField>
   <div class="sm:col-span-2 lg:col-span-4"><UiButton type="submit" :loading="busy" :disabled="!teacherProfileId"><Plus :size="16"/> Añadir franja semanal</UiButton></div>
  </form>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="message" tone="success" class="mt-4">{{message}}</UiAlert>
  <p v-if="loading" class="mt-5 text-xs text-muted">Cargando horarios...</p>
  <div v-else class="mt-5 space-y-2">
   <div v-for="slot in slots" :key="slot.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-3">
    <div><p class="text-sm font-bold">{{teacherName(slot.teacherProfileId)}}</p>
      <p class="mt-1 text-xs text-muted">{{weekdays[slot.dayOfWeek]}} · {{hhmm(slot.startMinute)}}–{{hhmm(slot.endMinute)}}</p></div>
    <UiButton size="sm" variant="danger" :disabled="busy" @click="remove(slot)"><Trash2 :size="14"/> Quitar</UiButton>
   </div>
   <p v-if="!slots.length" class="text-xs text-muted">No hay horarios semanales configurados. Los profesores pueden agendar libremente hasta que definas sus franjas.</p>
  </div>
 </UiCard>
</template>