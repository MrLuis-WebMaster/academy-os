<script setup lang="ts">
import {computed,ref} from 'vue';
import {CalendarX2,Layers3} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Lesson={
 id:string;title:string;startsAt:string;status:string;
 seriesId?:string|null;seriesIndex?:number|null;
};
const props=defineProps<{workspaceId:string;sessions:Lesson[]}>();
const emit=defineEmits<{updated:[]}>();
const groups=computed(()=>{
 const now=Date.now();
 const map=new Map<string,{seriesId:string;title:string;count:number;firstAt:string}>();
 for(const lesson of props.sessions){
  if(!lesson.seriesId||lesson.status!=='CONFIRMED'||new Date(lesson.startsAt).getTime()<=now)continue;
  const found=map.get(lesson.seriesId);
  if(found){found.count++;if(lesson.startsAt<found.firstAt)found.firstAt=lesson.startsAt;}
  else map.set(lesson.seriesId,{seriesId:lesson.seriesId,title:lesson.title,count:1,firstAt:lesson.startsAt});
 }
 return [...map.values()].sort((a,b)=>a.firstAt.localeCompare(b.firstAt));
});
const busy=ref(''),error=ref(''),message=ref('');
async function cancelFuture(seriesId:string,title:string,count:number){
 if(!window.confirm('¿Cancelar las '+count+' próximas clases de "'+title+'"? Las clases anteriores y las actividades ya realizadas se conservan. Los alumnos con reservas recibirán un aviso dentro de AcademyOS.'))return;
 busy.value=seriesId;error.value='';message.value='';
 try{
  const result=await apiJson<{cancelledSessions:number;inAppNotificationsCreated:number}>(
   workspacePath(props.workspaceId,'/sessions/weekly-series/'+encodeURIComponent(seriesId)+'/cancel-future'),'PATCH',
  );
  message.value='Se cancelaron '+result.cancelledSessions+' clases futuras. Se crearon '+result.inAppNotificationsCreated+' avisos dentro de AcademyOS para las reservas afectadas.';
  emit('updated');
 }catch(e){error.value=e instanceof Error?e.message:'No se pudieron cancelar las clases pendientes.';}
 finally{busy.value='';}
}
</script>
<template>
 <UiCard v-if="groups.length" class="mt-6">
  <template #header>
   <div class="flex items-center gap-3"><Layers3 :size="22" class="text-brand"/><div>
    <h2 class="text-lg font-extrabold">Series de clases semanales</h2>
    <p class="mt-1 text-xs text-muted">Cancela solo las próximas sesiones de una serie; nunca se borra el historial de clases anteriores.</p>
   </div></div>
  </template>
  <div class="space-y-2">
   <div v-for="group in groups" :key="group.seriesId" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-3">
    <div>
     <p class="text-sm font-bold">{{group.title}}</p>
     <p class="mt-1 text-xs text-muted">{{group.count}} clases por impartir · desde {{new Date(group.firstAt).toLocaleString('es-CO')}}</p>
    </div>
    <UiButton size="sm" variant="danger" :loading="busy===group.seriesId"
      :disabled="Boolean(busy)" @click="cancelFuture(group.seriesId,group.title,group.count)">
      <CalendarX2 :size="15"/> Cancelar próximas
    </UiButton>
   </div>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="message" tone="success" class="mt-4">{{message}}</UiAlert>
  <p class="mt-3 text-xs text-muted">Esta acción no envía emails ni mensajes externos. Las reservas existentes quedarán asociadas a clases canceladas para mantener su historial.</p>
 </UiCard>
</template>
