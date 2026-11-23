<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import {CalendarClock,CalendarX2,Layers3,Pencil,Save,X} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Lesson={
 id:string;title:string;startsAt:string;endsAt:string;status:string;
 seriesId?:string|null;seriesIndex?:number|null;
 capacity:number;mode:'ONLINE'|'ONSITE'|'HYBRID';
 meetingUrl:string|null;location:string|null;
};
const props=defineProps<{workspaceId:string;sessions:Lesson[]}>();
const emit=defineEmits<{updated:[]}>();
const groups=computed(()=>{
 const now=Date.now();
 const map=new Map<string,{seriesId:string;title:string;count:number;firstAt:string;first:Lesson}>();
 for(const lesson of props.sessions){
  if(!lesson.seriesId||lesson.status!=='CONFIRMED'||new Date(lesson.startsAt).getTime()<=now)continue;
  const found=map.get(lesson.seriesId);
  if(found){
   found.count++;
   if((lesson.seriesIndex??999)<(found.first.seriesIndex??999)){
    found.first=lesson;
    found.title=lesson.title;
   }
   if(lesson.startsAt<found.firstAt)found.firstAt=lesson.startsAt;
  }else{
   map.set(lesson.seriesId,{
    seriesId:lesson.seriesId,title:lesson.title,
    count:1,firstAt:lesson.startsAt,first:lesson,
   });
  }
 }
 return [...map.values()].sort((a,b)=>a.firstAt.localeCompare(b.firstAt));
});

const busy=ref(''),error=ref(''),message=ref(''),editing=ref('');
const title=ref(''),capacity=ref(1),mode=ref<'ONLINE'|'ONSITE'|'HYBRID'>('ONLINE');
const meetingUrl=ref(''),location=ref(''),reason=ref('');
const changeTime=ref(false),date=ref(''),starts=ref('09:00'),ends=ref('10:00');
function localDate(date:Date){
 const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0');
 return year+'-'+month+'-'+String(date.getDate()).padStart(2,'0');
}
function localTime(date:Date){
 return String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');
}
function beginEdit(group:(typeof groups.value)[number]){
 const lesson=group.first;
 editing.value=group.seriesId;
 title.value=lesson.title;
 capacity.value=lesson.capacity;
 mode.value=lesson.mode;
 meetingUrl.value=lesson.meetingUrl??'';
 location.value=lesson.location??'';
 reason.value='';
 changeTime.value=false;
 date.value=localDate(new Date(lesson.startsAt));
 starts.value=localTime(new Date(lesson.startsAt));
 ends.value=localTime(new Date(lesson.endsAt));
 error.value='';message.value='';
}
function closeEdit(){editing.value='';error.value='';}
async function updateFuture(seriesId:string){
 if(busy.value)return;
 const workspaceId=props.workspaceId;
 const body:Record<string,unknown>={
  reason:reason.value,title:title.value,capacity:capacity.value,mode:mode.value,
  meetingUrl:mode.value==='ONSITE'?null:meetingUrl.value||null,
  location:mode.value==='ONLINE'?null:location.value||null,
 };
 if(changeTime.value){
  const start=new Date(date.value+'T'+starts.value+':00');
  const end=new Date(date.value+'T'+ends.value+':00');
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())){
   error.value='Selecciona una fecha y horas válidas.';return;
  }
  body.startsAt=start.toISOString();
  body.endsAt=end.toISOString();
 }
 busy.value=seriesId;error.value='';message.value='';
 try{
  const result=await apiJson<{updatedSessions:number;affectedBookings:number}>(
   workspacePath(workspaceId,'/sessions/weekly-series/'+encodeURIComponent(seriesId)+'/future'),
   'PATCH',body,
  );
  if(workspaceId!==props.workspaceId)return;
  editing.value='';
  message.value='Se actualizaron '+result.updatedSessions+' clases futuras.'+
   (result.affectedBookings?' Se notificó a estudiantes con reservas de los cambios de horario.':'');
  emit('updated');
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudieron actualizar las clases futuras.';
  }
 }finally{busy.value='';}
}
async function cancelFuture(seriesId:string,groupTitle:string,count:number){
 if(busy.value||!window.confirm(
  '¿Cancelar las '+count+' próximas clases de "'+groupTitle+'"? Las clases anteriores y las actividades ya realizadas se conservan. Los alumnos con reservas recibirán un aviso dentro de AcademyOS.'
 ))return;
 const workspaceId=props.workspaceId;
 busy.value=seriesId;error.value='';message.value='';
 try{
  const result=await apiJson<{cancelledSessions:number;inAppNotificationsCreated:number}>(
   workspacePath(workspaceId,'/sessions/weekly-series/'+encodeURIComponent(seriesId)+'/cancel-future'),'PATCH',
  );
  if(workspaceId!==props.workspaceId)return;
  editing.value='';
  message.value='Se cancelaron '+result.cancelledSessions+' clases futuras. Se crearon '+
    result.inAppNotificationsCreated+' avisos internos.';
  emit('updated');
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudieron cancelar las clases pendientes.';
  }
 }finally{busy.value='';}
}
watch(()=>props.workspaceId,()=>{
 editing.value='';busy.value='';error.value='';message.value='';
});
</script>
<template>
 <UiCard v-if="groups.length" class="mt-6">
  <template #header>
   <div class="flex items-center gap-3"><Layers3 :size="22" class="text-brand"/><div>
    <h2 class="text-lg font-extrabold">Series de clases semanales</h2>
    <p class="mt-1 text-xs text-muted">Modifica o cancela las próximas clases sin eliminar el historial ni las reservas previas.</p>
   </div></div>
  </template>
  <div class="space-y-3">
   <div v-for="group in groups" :key="group.seriesId" class="rounded-xl border border-outline p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
     <div>
      <p class="text-sm font-bold">{{group.title}}</p>
      <p class="mt-1 text-xs text-muted">{{group.count}} clases por impartir · desde {{new Date(group.firstAt).toLocaleString('es-CO')}}</p>
     </div>
     <div class="flex flex-wrap gap-2">
      <UiButton size="sm" variant="secondary" :disabled="Boolean(busy)" @click="editing===group.seriesId?closeEdit():beginEdit(group)">
       <X v-if="editing===group.seriesId" :size="15"/><Pencil v-else :size="15"/>
       {{editing===group.seriesId?'Cerrar':'Editar próximas'}}
      </UiButton>
      <UiButton size="sm" variant="danger" :loading="busy===group.seriesId"
       :disabled="Boolean(busy)" @click="cancelFuture(group.seriesId,group.title,group.count)">
       <CalendarX2 :size="15"/> Cancelar próximas
      </UiButton>
     </div>
    </div>
    <form v-if="editing===group.seriesId" class="mt-4 space-y-3 border-t border-outline pt-4" @submit.prevent="updateFuture(group.seriesId)">
     <p class="text-xs text-muted">Los cambios se aplican únicamente a sesiones futuras confirmadas. Los cupos no pueden bajar del número de reservas existentes.</p>
     <div class="grid gap-3 md:grid-cols-2">
      <label class="text-xs font-semibold">Título<input v-model="title" required minlength="3" maxlength="120" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
      <label class="text-xs font-semibold">Cupos por clase<input v-model.number="capacity" required type="number" min="1" max="500" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
      <label class="text-xs font-semibold">Modalidad<select v-model="mode" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"><option value="ONLINE">Virtual</option><option value="ONSITE">Presencial</option><option value="HYBRID">Híbrida</option></select></label>
      <label v-if="mode!=='ONSITE'" class="text-xs font-semibold">Enlace HTTPS<input v-model="meetingUrl" required type="url" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm" placeholder="https://meet.google.com/..."/></label>
      <label v-if="mode!=='ONLINE'" class="text-xs font-semibold">Lugar<input v-model="location" required minlength="5" maxlength="300" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm" placeholder="Sede, aula o dirección"/></label>
     </div>
     <label class="flex items-center gap-2 text-xs font-semibold"><input v-model="changeTime" type="checkbox" class="accent-brand"/> También cambiar fecha y horario de las futuras clases</label>
     <div v-if="changeTime" class="grid gap-3 sm:grid-cols-3">
      <label class="text-xs font-semibold">Nueva primera fecha<input v-model="date" type="date" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
      <label class="text-xs font-semibold">Hora de inicio<input v-model="starts" type="time" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
      <label class="text-xs font-semibold">Hora de fin<input v-model="ends" type="time" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
      <p class="text-xs text-muted sm:col-span-3"><CalendarClock :size="14" class="inline"/> La fecha se interpreta en la zona horaria de tu dispositivo. La serie mantiene la hora local programada al cruzar cambios de horario de verano.</p>
     </div>
     <label class="block text-xs font-semibold">Motivo del cambio<input v-model="reason" required minlength="5" maxlength="300" placeholder="Ej. Nuevo horario acordado con el grupo" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
     <UiButton type="submit" :disabled="Boolean(busy)" :loading="busy===group.seriesId"><Save :size="15"/> Guardar cambios futuros</UiButton>
    </form>
   </div>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="message" tone="success" class="mt-4">{{message}}</UiAlert>
  <p class="mt-3 text-xs text-muted">Las reprogramaciones crean avisos internos para alumnos con reserva; todavía no se envían correos ni WhatsApp.</p>
 </UiCard>
</template>
