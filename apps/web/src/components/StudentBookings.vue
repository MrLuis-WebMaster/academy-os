<script setup lang="ts">
import { apiJson, workspacePath } from '../shared/api-client';
import {onMounted,ref,watch} from 'vue';
import {CalendarCheck,CheckCircle2} from 'lucide-vue-next';
type ClassSession={id:string;title:string;startsAt:string};
type Booking={id:string;sessionId:string;status:'BOOKED'|'CANCELLED';bookedAt:string};
const props=defineProps<{workspaceId:string;sessions:ClassSession[]}>();
const mine=ref<Booking[]>([]),loading=ref(false),busy=ref(''),error=ref(''),notice=ref('');
async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
  return apiJson<T>(workspacePath(props.workspaceId,'/bookings'+path),method,body);
}
async function load(){
 loading.value=true;
 try{
   mine.value=await request<Booking[]>('/mine');error.value='';
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo cargar tu agenda.';}
 finally{loading.value=false;}
}
function existing(sessionId:string){return mine.value.find(b=>b.sessionId===sessionId&&b.status==='BOOKED');}
async function reserve(sessionId:string){
 busy.value=sessionId;error.value='';notice.value='';
 try{await request('','POST',{sessionId});await load();notice.value='Tu cupo quedó reservado.';}
 catch(e){error.value=e instanceof Error?e.message:'No se pudo reservar tu cupo.';}
 finally{busy.value='';}
}
async function cancel(booking:Booking){
 if(!window.confirm('¿Cancelar tu reserva para esta clase?'))return;
 busy.value=booking.sessionId;error.value='';notice.value='';
 try{await request('/'+booking.id+'/cancel','PATCH');await load();notice.value='Reserva cancelada.';}
 catch(e){error.value=e instanceof Error?e.message:'No se pudo cancelar.';}
 finally{busy.value='';}
}
watch(()=>props.workspaceId,load);
onMounted(load);
</script>
<template>
<section class="rounded-2xl border border-outline bg-surface p-6">
 <div class="flex items-center gap-3"><CalendarCheck :size="21" class="text-brand"/><div><h2 class="text-lg font-extrabold">Reserva tus clases</h2><p class="mt-1 text-xs text-muted">Confirma tu cupo en las sesiones disponibles de tus cursos. Los cupos son limitados.</p></div></div>
 <p v-if="error" role="alert" class="mt-4 rounded-xl bg-danger-soft p-3 text-xs text-danger">{{ error }}</p>
 <p v-if="notice" role="status" class="mt-4 flex items-center gap-2 rounded-xl bg-success-soft p-3 text-xs text-success"><CheckCircle2 :size="15"/>{{ notice }}</p>
 <p v-if="loading" class="mt-4 text-xs text-muted">Consultando tus reservas...</p>
 <div class="mt-4 space-y-2">
  <div v-for="session in sessions.filter(s=>new Date(s.startsAt)>new Date())" :key="session.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-4">
   <div><p class="text-sm font-bold">{{ session.title }}</p><p class="mt-1 text-xs text-muted">{{ new Date(session.startsAt).toLocaleString('es-CO') }}</p></div>
   <button v-if="existing(session.id)" :disabled="busy===session.id" class="rounded-xl border border-amber-200 px-4 py-2 text-xs font-bold text-warning disabled:opacity-50" @click="cancel(existing(session.id)!)">Cancelar mi cupo</button>
   <button v-else :disabled="busy===session.id || loading" class="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50" @click="reserve(session.id)">Reservar cupo</button>
  </div>
  <p v-if="!sessions.some(s=>new Date(s.startsAt)>new Date())" class="text-xs text-muted">No hay sesiones futuras disponibles para reservar.</p>
 </div>
</section>
</template>