<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {ClipboardCheck,RefreshCcw} from 'lucide-vue-next';
const props=defineProps<{workspaceId:string}>();
type RecordRow={id:string;sessionId:string;attendance:'PRESENT'|'ABSENT'|'LATE'|'EXCUSED'|null;student:{name:string};session:{title:string;startsAt:string}};
const rows=ref<RecordRow[]>([]),loading=ref(true),error=ref(''),message=ref(''),busy=ref('');
async function load(){
 loading.value=true;error.value='';
 try{
  const response=await fetch('/api/v1/workspaces/'+props.workspaceId+'/bookings/staff',{credentials:'same-origin'});
  if(!response.ok)throw Error('No se pudo cargar la asistencia.');
  rows.value=await response.json() as RecordRow[];
 }catch(e){error.value=e instanceof Error?e.message:'Error al cargar asistencia';}
 finally{loading.value=false;}
}
async function save(bookingId:string,attendance:RecordRow['attendance']){
 if(!attendance)return;
 busy.value=bookingId;error.value='';message.value='';
 try{
  const response=await fetch('/api/v1/workspaces/'+props.workspaceId+'/bookings/'+bookingId+'/attendance',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({attendance})});
  if(!response.ok)throw Error('No se pudo guardar asistencia.');
  await load();message.value='Asistencia actualizada.';
 }catch(e){error.value=e instanceof Error?e.message:'Error al guardar';}
 finally{busy.value='';}
}
watch(()=>props.workspaceId,load);
onMounted(load);
</script>
<template>
<section class="mt-6 rounded-2xl border border-outline bg-surface p-6">
 <div class="flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-2"><ClipboardCheck :size="20" class="text-brand"/><div><h2 class="text-lg font-extrabold">Registro de asistencia</h2><p class="mt-1 text-xs text-muted">Para alumnos con cupo confirmado en una sesión.</p></div></div><button class="flex items-center gap-1 rounded-lg border border-outline px-3 py-2 text-xs font-bold" @click="load"><RefreshCcw :size="14"/> Actualizar</button></div>
 <p v-if="error" role="alert" class="mt-4 rounded-xl bg-danger-soft p-3 text-xs text-danger">{{ error }}</p>
 <p v-if="message" role="status" class="mt-4 rounded-xl bg-success-soft p-3 text-xs text-success">{{ message }}</p>
 <p v-if="loading" class="mt-4 text-xs text-muted">Cargando registros...</p>
 <div v-else class="mt-4 divide-y divide-outline">
  <div v-for="record in rows" :key="record.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
   <div><p class="text-sm font-bold">{{ record.student.name }}</p><p class="mt-1 text-xs text-muted">{{ record.session.title }} · {{ new Date(record.session.startsAt).toLocaleString('es-CO') }}</p></div>
   <select :value="record.attendance??''" :disabled="busy===record.id" class="rounded-lg border border-outline p-2 text-xs" :aria-label="'Asistencia de '+record.student.name" @change="save(record.id,($event.target as HTMLSelectElement).value as RecordRow['attendance'])">
    <option value="">Sin registrar</option>
    <option value="PRESENT">Asistió</option><option value="LATE">Llegó tarde</option><option value="ABSENT">No asistió</option><option value="EXCUSED">Excusado</option>
   </select>
  </div>
  <p v-if="!rows.length" class="py-4 text-xs text-muted">Aún no hay reservas de alumnos confirmadas.</p>
 </div>
</section>
</template>