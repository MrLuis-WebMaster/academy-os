<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {CalendarCheck,CheckCircle2} from 'lucide-vue-next';
type ClassSession={id:string;title:string;startsAt:string};
type Booking={id:string;sessionId:string;status:'BOOKED'|'CANCELLED';bookedAt:string};
const props=defineProps<{workspaceId:string;sessions:ClassSession[]}>();
const mine=ref<Booking[]>([]),loading=ref(false),busy=ref(''),error=ref(''),notice=ref('');
async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/api/v1/workspaces/'+props.workspaceId+'/bookings'+path,{
   method,credentials:'same-origin',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})
 });
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data&&typeof data==='object'&&'message' in data&&typeof data.message==='string'?data.message:'No se pudo actualizar tu reserva.');
 return data as T;
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
<section class="rounded-2xl border border-outline bg-white p-6">
 <div class="flex items-center gap-3"><CalendarCheck :size="21" class="text-brand"/><div><h2 class="text-lg font-extrabold">Reserva tus clases</h2><p class="mt-1 text-xs text-muted">Confirma tu cupo en las sesiones disponibles de tus cursos. Los cupos son limitados.</p></div></div>
 <p v-if="error" role="alert" class="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{{ error }}</p>
 <p v-if="notice" role="status" class="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 :size="15"/>{{ notice }}</p>
 <p v-if="loading" class="mt-4 text-xs text-muted">Consultando tus reservas...</p>
 <div class="mt-4 space-y-2">
  <div v-for="session in sessions.filter(s=>new Date(s.startsAt)>new Date())" :key="session.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-4">
   <div><p class="text-sm font-bold">{{ session.title }}</p><p class="mt-1 text-xs text-muted">{{ new Date(session.startsAt).toLocaleString('es-CO') }}</p></div>
   <button v-if="existing(session.id)" :disabled="busy===session.id" class="rounded-xl border border-amber-200 px-4 py-2 text-xs font-bold text-amber-700 disabled:opacity-50" @click="cancel(existing(session.id)!)">Cancelar mi cupo</button>
   <button v-else :disabled="busy===session.id || loading" class="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50" @click="reserve(session.id)">Reservar cupo</button>
  </div>
  <p v-if="!sessions.some(s=>new Date(s.startsAt)>new Date())" class="text-xs text-muted">No hay sesiones futuras disponibles para reservar.</p>
 </div>
</section>
</template>