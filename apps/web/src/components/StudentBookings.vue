<script setup lang="ts">
import {apiJson,workspacePath} from '../shared/api-client';
import {computed,onMounted,ref,watch} from 'vue';
import {BellRing,CalendarCheck,CheckCircle2,Layers3,Ticket,Gift} from 'lucide-vue-next';
import {UiAlert,UiButton,UiSwitch} from '@academy-os/ui';

type ClassSession={id:string;title:string;startsAt:string;seriesId:string|null;seriesIndex:number|null;requiresPackage:boolean};
type Booking={id:string;sessionId:string;status:'BOOKED'|'CANCELLED';bookedAt:string;
 session:{title:string;courseId:string|null;status:string;startsAt:string;changes:Array<{
  id:string;changedAt:string;reason:string;oldStartsAt:string;newStartsAt:string;
 }>};
};
const props=defineProps<{workspaceId:string;sessions:ClassSession[]}>();
const emit=defineEmits<{updated:[]}>();
const mine=ref<Booking[]>([]),loading=ref(false),busy=ref(''),error=ref(''),notice=ref('');
type Entitlement={
 id:string;studentUserId:string;credits:number;used:number;remaining:number;available:number;
 activeBookingIds:string[];expiresAt:string;revokedAt:string|null;
 package:{title:string;courseId:string|null;priceCOP:number};
};
const entitlements=ref<Entitlement[]>([]),creditsLoading=ref(false),creditsError=ref('');
const chosenGrant=ref<Record<string,string>>({});
let creditsVersion=0;
async function loadCredits(){
 const workspace=props.workspaceId,version=++creditsVersion;
 creditsLoading.value=true;creditsError.value='';entitlements.value=[];
 try{
  const list=await apiJson<Entitlement[]>(workspacePath(workspace,'/packages/mine'));
  if(version!==creditsVersion||workspace!==props.workspaceId)return;
  entitlements.value=list;
 }catch(e){
  if(version===creditsVersion&&workspace===props.workspaceId)
   creditsError.value=e instanceof Error?e.message:'No se pudieron consultar los créditos de clase.';
 }finally{if(version===creditsVersion)creditsLoading.value=false;}
}
function redeemedBy(bookingId:string){
 return entitlements.value.find(grant=>grant.activeBookingIds.includes(bookingId))??null;
}
function availableFor(booking:Booking){
 const startsAt=new Date(booking.session.startsAt).getTime(),now=Date.now();
 return entitlements.value.filter(grant=>
  !grant.revokedAt&&grant.available>0&&new Date(grant.expiresAt).getTime()>=startsAt
  &&new Date(grant.expiresAt).getTime()>now
  &&(!grant.package.courseId||grant.package.courseId===booking.session.courseId),
 );
}
async function redeemCredit(booking:Booking){
 if(busy.value)return;
 const entitlementId=chosenGrant.value[booking.id]||availableFor(booking)[0]?.id;
 if(!entitlementId)return;
 const workspace=props.workspaceId;
 busy.value='credit:'+booking.id;error.value='';notice.value='';
 try{
  const result=await apiJson<{remaining:number;alreadyRedeemed:boolean}>(
   workspacePath(workspace,'/packages/redeem'),'POST',
   {bookingId:booking.id,entitlementId},
  );
  if(workspace!==props.workspaceId)return;
  await loadCredits();
  if(workspace===props.workspaceId){
   notice.value=result.alreadyRedeemed?'Ya habías usado un crédito en esta reserva.':
    'Se aplicó un crédito a tu clase reservada. Te quedan '+result.remaining+' en este paquete.';
  }
 }catch(e){
  if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo aplicar el crédito.';
 }finally{busy.value='';}
}

type ReminderPrefs={remind24h:boolean;remind1h:boolean};
const preferences=ref<ReminderPrefs>({remind24h:false,remind1h:false});
const preferencesLoading=ref(true),preferencesSaving=ref(false),preferencesError=ref('');
let preferenceVersion=0;
async function loadPreferences(){
 const workspace=props.workspaceId,version=++preferenceVersion;
 preferencesLoading.value=true;preferencesError.value='';
 preferences.value={remind24h:false,remind1h:false};
 try{
  const data=await apiJson<ReminderPrefs>(workspacePath(workspace,'/notifications/reminder-preferences'));
  if(version!==preferenceVersion||workspace!==props.workspaceId)return;
  preferences.value=data;
 }catch(e){
  if(version===preferenceVersion&&workspace===props.workspaceId){
   preferencesError.value=e instanceof Error?e.message:'No se pudieron leer tus preferencias de recordatorios.';
  }
 }finally{if(version===preferenceVersion)preferencesLoading.value=false;}
}
async function savePreferences(){
 if(preferencesSaving.value)return;
 const workspace=props.workspaceId;
 preferencesSaving.value=true;preferencesError.value='';notice.value='';
 try{
  const value=await apiJson<ReminderPrefs>(
   workspacePath(workspace,'/notifications/reminder-preferences'),'PATCH',preferences.value,
  );
  if(workspace!==props.workspaceId)return;
  preferences.value=value;
  notice.value='Tus recordatorios internos fueron actualizados.';
 }catch(e){
  if(workspace===props.workspaceId){
   preferencesError.value=e instanceof Error?e.message:'No se pudieron guardar tus recordatorios.';
  }
 }finally{preferencesSaving.value=false;}
}
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
  emit('updated');
  await load();
  await loadCredits();
  if(workspaceId===props.workspaceId)notice.value=props.sessions.find(item=>item.id===sessionId)?.requiresPackage
   ?'Reserva confirmada. Se descontó automáticamente un crédito de paquete.'
   :'Tu cupo quedó reservado.';
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
  emit('updated');
  await load();
  await loadCredits();
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
  emit('updated');
  await load();
  await loadCredits();
  if(workspaceId===props.workspaceId){
   const requiresCredits=props.sessions.some(item=>item.seriesId===seriesId&&item.requiresPackage);
   notice.value=result.booked
    ?'Reservaste '+result.booked+' clases de la serie.'+(requiresCredits
      ?' Se descontó un crédito por cada nueva reserva.':' Se respetaron tus reservas existentes.')
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
  emit('updated');
  await load();
  await loadCredits();
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
 ++preferenceVersion;
 ++creditsVersion;entitlements.value=[];chosenGrant.value={};creditsError.value='';
 mine.value=[];busy.value='';notice.value='';error.value='';
 preferences.value={remind24h:false,remind1h:false};preferencesError.value='';
 void load();
 void loadPreferences();
 void loadCredits();
});
onMounted(()=>{
 void load();
 void loadPreferences();
 void loadCredits();
});
</script>
<template>
<section class="rounded-2xl border border-outline bg-surface p-6">
 <div class="flex items-center gap-3"><CalendarCheck :size="21" class="text-brand"/><div><h2 class="text-lg font-extrabold">Reserva tus clases</h2><p class="mt-1 text-xs text-muted">Confirma tu cupo en las sesiones disponibles de tus cursos. Los cupos son limitados.</p></div></div>
 <p v-if="error" role="alert" class="mt-4 rounded-xl bg-danger-soft p-3 text-xs text-danger">{{ error }}</p>
 <p v-if="notice" role="status" class="mt-4 flex items-center gap-2 rounded-xl bg-success-soft p-3 text-xs text-success"><CheckCircle2 :size="15"/>{{ notice }}</p>
 <p v-if="loading" class="mt-4 text-xs text-muted">Consultando tus reservas...</p>
 <section class="mt-5 rounded-xl border border-outline bg-surface-muted p-4" aria-label="Créditos de paquetes">
  <div class="flex items-center gap-2"><Ticket :size="17" class="text-brand"/><h3 class="text-sm font-extrabold">Mis paquetes de clases</h3></div>
  <p class="mt-2 text-xs text-muted">Tu academia puede asignarte créditos manualmente. El precio de referencia no demuestra un pago procesado por AcademyOS.</p>
  <p v-if="creditsLoading" class="mt-3 text-xs text-muted">Consultando créditos…</p>
  <div v-else-if="entitlements.length" class="mt-3 grid gap-2 sm:grid-cols-2">
   <article v-for="grant in entitlements" :key="grant.id" class="rounded-xl border border-outline bg-surface p-3">
    <p class="flex items-center gap-2 text-xs font-bold"><Gift :size="14" class="text-brand"/>{{grant.package.title}}</p>
    <p class="mt-2 text-2xl font-extrabold">{{grant.available}} <span class="text-xs font-normal text-muted">créditos aplicables · {{grant.remaining}} sin consumir de {{grant.credits}}</span></p>
    <p class="mt-1 text-xs text-muted">Vigencia: {{new Date(grant.expiresAt).toLocaleDateString('es-CO')}}
     <span v-if="grant.revokedAt"> · Revocado</span>
     <span v-else-if="new Date(grant.expiresAt).getTime()<Date.now()"> · Vencido</span>
    </p>
   </article>
  </div>
  <p v-else class="mt-3 text-xs text-muted">No tienes paquetes asignados por esta academia.</p>
  <UiAlert v-if="creditsError" tone="warning" class="mt-3">{{creditsError}}</UiAlert>
 </section>
 <section class="mt-5 rounded-xl border border-outline bg-surface-muted p-4" aria-label="Preferencias de recordatorios">
  <div class="flex items-center gap-2"><BellRing :size="16" class="text-brand"/><h3 class="text-sm font-extrabold">Recordatorios de clase</h3></div>
  <p class="mt-2 text-xs text-muted">Recibe avisos dentro de AcademyOS para las clases que hayas reservado. Están desactivados hasta que los autorices. No se enviarán correos ni WhatsApp.</p>
  <p v-if="preferencesLoading" class="mt-3 text-xs text-muted">Cargando preferencias…</p>
  <div v-else class="mt-3 flex flex-wrap items-center gap-4">
   <UiSwitch v-model="preferences.remind24h" label="24 horas antes" />
   <UiSwitch v-model="preferences.remind1h" label="1 hora antes" />
   <UiButton size="sm" variant="secondary" :disabled="preferencesSaving" :loading="preferencesSaving" @click="savePreferences">Guardar recordatorios</UiButton>
  </div>
  <UiAlert v-if="preferencesError" tone="warning" class="mt-3">{{preferencesError}}</UiAlert>
 </section>
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
   <div><p class="text-sm font-bold">{{session.title}}</p>
    <p class="mt-1 text-xs text-muted">{{new Date(session.startsAt).toLocaleString('es-CO')}}</p>
    <p v-if="session.requiresPackage" class="mt-1 text-xs font-semibold text-warning">
      Se descontará 1 crédito al reservar
    </p>
   </div>
   <div v-if="existing(session.id)" class="flex flex-col items-end gap-2">
    <p v-if="redeemedBy(existing(session.id)!.id)" class="text-xs font-semibold text-success">
     <Ticket :size="14" class="mr-1 inline"/> Crédito de {{redeemedBy(existing(session.id)!.id)?.package.title}} aplicado
    </p>
    <div v-else-if="availableFor(existing(session.id)!).length" class="flex flex-wrap items-center gap-2">
     <label class="text-xs font-semibold">Usar paquete
      <select v-model="chosenGrant[existing(session.id)!.id]"
       class="ml-2 rounded-lg border border-outline bg-surface px-2 py-2 text-xs">
       <option value="">Elige uno</option>
       <option v-for="grant in availableFor(existing(session.id)!)" :key="grant.id" :value="grant.id">
        {{grant.package.title}} · {{grant.available}} créditos
       </option>
      </select>
     </label>
     <UiButton size="sm" variant="secondary" :disabled="Boolean(busy)" :loading="busy==='credit:'+existing(session.id)!.id"
      @click="redeemCredit(existing(session.id)!)">Aplicar crédito</UiButton>
    </div>
    <button :disabled="Boolean(busy)" class="rounded-xl border border-amber-200 px-4 py-2 text-xs font-bold text-warning disabled:opacity-50"
     @click="cancel(existing(session.id)!)">Cancelar mi cupo</button>
   </div>
   <button v-else :disabled="Boolean(busy)||loading" class="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
    @click="reserve(session.id)">Reservar cupo</button>
  </div>
  <p v-if="!sessions.some(s=>new Date(s.startsAt)>new Date())" class="text-xs text-muted">No hay sesiones futuras disponibles para reservar.</p>
 </div>
</section>
</template>