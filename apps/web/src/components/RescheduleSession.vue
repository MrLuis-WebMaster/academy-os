<script setup lang="ts">
import {computed,ref} from 'vue';
import {CalendarClock} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard,UiField,UiInput,UiSelect} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Lesson={id:string;title:string;startsAt:string;endsAt:string;status:string};
const props=defineProps<{workspaceId:string;sessions:Lesson[]}>();
const emit=defineEmits<{updated:[]}>();
const selectedId=ref(''),date=ref(''),startTime=ref(''),endTime=ref(''),reason=ref('');
const busy=ref(false),error=ref(''),notice=ref(''),affected=ref(0);
const eligible=computed(()=>props.sessions.filter(s=>s.status==='CONFIRMED'&&new Date(s.startsAt)>new Date()));
const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
function pad(value:number){return String(value).padStart(2,'0');}
function edit(id:string){
 selectedId.value=id;error.value='';notice.value='';affected.value=0;
 const session=props.sessions.find(x=>x.id===id);
 if(!session)return;
 const start=new Date(session.startsAt),end=new Date(session.endsAt);
 date.value=[start.getFullYear(),pad(start.getMonth()+1),pad(start.getDate())].join('-');
 startTime.value=pad(start.getHours())+':'+pad(start.getMinutes());
 endTime.value=pad(end.getHours())+':'+pad(end.getMinutes());
}
async function submit(){
 busy.value=true;error.value='';notice.value='';
 try{
  const startsAt=new Date(date.value+'T'+startTime.value+':00');
  const endsAt=new Date(date.value+'T'+endTime.value+':00');
  if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime()))throw Error('Elige una fecha válida');
  const response=await apiJson<{affectedBookings:number;manualNotificationRequired:boolean}>(
   workspacePath(props.workspaceId,'/sessions/'+encodeURIComponent(selectedId.value)+'/reschedule'),
   'PATCH',{startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),reason:reason.value},
  );
  affected.value=response.affectedBookings;
  notice.value=response.manualNotificationRequired
   ?'Horario modificado. IMPORTANTE: debes avisar personalmente a '+response.affectedBookings+' alumno(s) con reservas. No se han enviado mensajes automáticos.'
   :'Clase reprogramada y cambio registrado en el historial.';
  emit('updated');
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo reprogramar la clase';}
 finally{busy.value=false;}
}
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><CalendarClock :size="21" class="text-brand"/><div><h2 class="text-lg font-extrabold">Reprogramar una clase</h2><p class="mt-1 text-xs text-muted">Comprueba disponibilidad, registra un motivo y conserva el historial del cambio.</p></div></div></template>
  <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="submit">
    <div class="sm:col-span-2"><UiField for="reschedule-session" label="Clase confirmada" required>
      <UiSelect id="reschedule-session" :model-value="selectedId" required @update:model-value="edit(String($event))">
        <option value="">Seleccionar clase</option>
        <option v-for="lesson in eligible" :key="lesson.id" :value="lesson.id">{{ lesson.title }} — {{ new Date(lesson.startsAt).toLocaleString('es-CO') }}</option>
      </UiSelect>
    </UiField></div>
    <UiField for="reschedule-date" label="Nueva fecha" required><UiInput id="reschedule-date" v-model="date" type="date" required/></UiField>
    <UiField for="reschedule-start" label="Hora de inicio" required><UiInput id="reschedule-start" v-model="startTime" type="time" required/></UiField>
    <UiField for="reschedule-end" label="Hora de finalización" required><UiInput id="reschedule-end" v-model="endTime" type="time" required/></UiField>
    <UiField for="reschedule-reason" label="Motivo del cambio" required><UiInput id="reschedule-reason" v-model="reason" :minlength="5" :maxlength="300" placeholder="Ej. El profesor solicitó cambiar de horario" required/></UiField>
    <p class="text-xs text-muted sm:col-span-2">Las horas se muestran en tu dispositivo ({{ timezone }}). Las reservas existentes se mantienen.</p>
    <div class="sm:col-span-2"><UiButton type="submit" :loading="busy" :disabled="!selectedId" block>Guardar nueva fecha</UiButton></div>
  </form>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{ error }}</UiAlert>
  <UiAlert v-if="notice" :tone="affected?'warning':'success'" class="mt-4">{{ notice }}</UiAlert>
  <p v-if="!eligible.length" class="mt-4 text-xs text-muted">No tienes clases futuras confirmadas para reprogramar.</p>
 </UiCard>
</template>