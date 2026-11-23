<script setup lang="ts">
import {apiJson,workspacePath} from '../shared/api-client';
import {computed,onMounted,ref,watch} from 'vue';
import {CalendarCheck,CheckCircle2,CalendarClock,Layers3} from 'lucide-vue-next';
import {UiAlert} from '@academy-os/ui';

type ClassSession={id:string;title:string;startsAt:string;seriesId:string|null;seriesIndex:number|null};
type Booking={id:string;sessionId:string;status:'BOOKED'|'CANCELLED';bookedAt:string;
 session:{title:string;status:string;startsAt:string;changes:Array<{
  id:string;changedAt:string;reason:string;oldStartsAt:string;newStartsAt:string;
 }>};
};
const props=defineProps<{workspaceId:string;sessions:ClassSession[]}>();
const mine=ref<Booking[]>([]),loading=ref(false),busy=ref(''),error=ref(''),notice=ref('');
let requestVersion=0;
function requestFor<T>(workspaceId:string,path:string,method='GET',body?:unknown):Promise<T>{
  return apiJson<T>(workspacePath(workspaceId,'/bookings'+path),method,body);
}
async function load(){
 const workspaceId=props.workspaceId,version=++requestVersion;
 loading.value=true;
 mine.value=[];
 try{
   const rows=await requestFor<Booking[]>(workspaceId,'/mine');
   if(version!==requestVersion||workspaceId!==props.workspaceId)return;
   mine.value=rows;
   error.value='';
 }catch(e){
   if(version===requestVersion&&workspaceId===props.workspaceId){
     error.value=e instanceof Error?e.message:'No se pudo cargar tu agenda.';
   }
 }finally{
   if(version===requestVersion)loading.value=false;
 }
}
function existing(sessionId:string){return mine.value.find(b=>b.sessionId===sessionId&&b.status==='BOOKED');}
const seriesGroups=computed(()=>{
 const now=Date.now();
 const map=new Map<string,{seriesId:string;title:string;total:number;reserved:number;startsAt:string}>();
 for(const s of props.sessions){
  if(!s.seriesId||new Date(s.startsAt).getTime()<=now)continue;
  const existingGroup=map.get(s.seriesId);
  if(existingGroup){
   existingGroup.total++;
   if(existing(s.id))existingGroup.reserved++;
   if(s.startsAt<existingGroup.startsAt)existingGroup.startsAt=s.startsAt;
  }else{
   map.set(s.seriesId,{
    seriesId:s.seriesId,title:s.title,total:1,
    reserved:existing(s.id)?1:0,startsAt:s.startsAt,
   });
  }
 }
 return [...map.values()].filter(x=>x.total>=2).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
});
async function reserve(sessionId:string){
 if(busy.value)return;
 const workspaceId=props.workspaceId;
 busy.value=sessionId;error.value='';notice.value='';
 try{
  await requestFor(workspaceId,'','POST',{sessionId});
  if(workspaceId!==props.workspaceId)return;
  await load();
  if(workspaceId===props.workspaceId)notice.value='Tu cupo quedó reservado.';
 }catch(e){
  if(workspaceId===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo reservar tu cupo.';
 }finally{busy.value='';}
}
async function cancel(booking:Booking){
 if(busy.value||!window.confirm('¿Cancelar tu reserva para esta clase?'))return;
 const workspaceId=props.workspaceId;
 busy.value=booking.sessionId;error.value='';notice.value='';
 try{
  await requestFor(workspaceId,'/'+encodeURIComponent(booking.id)+'/cancel','PATCH');
  if(workspaceId!==props.workspaceId)return;
  await load();
  if(workspaceId===props.workspaceId)notice.value='Reserva cancelada.';
 }catch(e){
  if(workspaceId===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo cancelar.';
 }finally{busy.value='';}
}
async function reserveSeries(seriesId:string){
 if(busy.value)return;
 const workspaceId=props.workspaceId;
 busy.value='series:'+seriesId;error.value='';notice.value='';
 try{
  const result=await requestFor<{total:number;booked:number;alreadyBooked:number}>(
   workspaceId,'/series','POST',{seriesId},
  );
  if(workspaceId!==props.workspaceId)return;
  await load();
  if(workspaceId===props.workspaceId){
   notice.value=result.booked
    ?'Reservaste '+result.booked+' clases de la serie. Se respetaron las reservas que ya tenías.'
    :'Ya tenías reservadas todas las clases futuras de esta serie.';
  }
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No fue posible reservar la serie completa.';
  }
 }finally{busy.value='';}
}
async function cancelSeries(seriesId:string,title:string){
 if(busy.value||!window.confirm('¿Cancelar tus próximas reservas de "'+title+'"? Las clases anteriores y tu progreso se conservarán.'))return;
 const workspaceId=props.workspaceId;
 busy.value='series:'+seriesId;error.value='';notice.value='';
 try{
  const result=await requestFor<{cancelledBookings:number}>(
   workspaceId,'/series/'+encodeURIComponent(seriesId)+'/cancel-future','PATCH',
  );
  if(workspaceId!==props.workspaceId)return;
  await load();
  if(workspaceId===props.workspaceId){
   notice.value='Se cancelaron '+result.cancelledBookings+' reservas futuras de la serie.';
  }
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudieron cancelar las reservas de esta serie.';
  }
 }finally{busy.value='';}
}
watch(()=>props.workspaceId,()=>{
 ++requestVersion;
 mine.value=[];busy.value='';notice.value='';error.value='';
 void load();
});
onMounted(()=>void load());
</script>
<template>
<section class="rounded-2xl border border-outline bg-surface p-6">
 <div class="flex items-center gap-3"><CalendarCheck :size="21" class="text-brand"/><div><h2 class="text-lg font-extrabold">Reserva tus clases</h2><p class="mt-1 text-xs text-muted">Confirma tu cupo en las sesiones disponibles de tus cursos. Los cupos son limitados.</p></div></div>
 <p v-if="error" role="alert" class="mt-4 rounded-xl bg-danger-soft p-3 text-xs text-danger">{{ error }}</p>
 <p v-if="notice" role="status" class="mt-4 flex items-center gap-2 rounded-xl bg-success-soft p-3 text-xs text-success"><CheckCircle2 :size="15"/>{{ notice }}</p>
 <p v-if="loading" class="mt-4 text-xs text-muted">Consultando tus reservas...</p>
 <div v-if="!loading" class="mt-4 space-y-2">
  <UiAlert v-for="booking in mine.filter(b=>b.status==='BOOKED'&&(b.session.status==='CANCELLED'||b.session.changes.length>0))" :key="booking.id" tone="warning">
   <strong>{{ booking.session.title }}:</strong>
   <template v-if="booking.session.status==='CANCELLED'"> esta clase fue cancelada. Consulta con tu academia para reorganizarla.</template>
   <template v-else> el horario fue modificado. Nuevo inicio: {{new Date(booking.session.startsAt).toLocaleString('es-CO')}}.
    <span v-if="booking.session.changes[0]?.reason"> Motivo: {{booking.session.changes[0].reason}}.</span>
   </template>
  </UiAlert>
 </div>
 <div v-if="seriesGroups.length && !loading" class="mt-5 space-y-3">
  <h3 class="flex items-center gap-2 text-sm font-bold"><Layers3 :size="17"/> Reservas semanales</h3>
  <div v-for="group in seriesGroups" :key="group.seriesId" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-4">
   <div>
    <p class="text-sm font-bold">{{group.title}}</p>
    <p class="mt-1 text-xs text-muted">{{group.reserved}} de {{group.total}} clases futuras reservadas · Desde {{new Date(group.startsAt).toLocaleString('es-CO')}}</p>
    <p class="mt-1 text-xs text-muted">La reserva conjunta se confirma únicamente si hay cupo en todas las clases pendientes.</p>
   </div>
   <div class="flex flex-wrap gap-2">
    <button v-if="group.reserved<group.total" :disabled="Boolean(busy)" class="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50" @click="reserveSeries(group.seriesId)">Reservar toda la serie</button>
    <button v-if="group.reserved>0" :disabled="Boolean(busy)" class="rounded-xl border border-outline px-3 py-2 text-xs font-bold text-warning disabled:opacity-50" @click="cancelSeries(group.seriesId,group.title)">Cancelar mis reservas futuras</button>
   </div>
  </div>
 </div>
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