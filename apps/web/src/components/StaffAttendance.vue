<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {ClipboardCheck,RefreshCcw,UsersRound} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard,UiEmptyState,UiSelect} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Attendance='PRESENT'|'ABSENT'|'LATE'|'EXCUSED';
type RecordRow={
  id:string;
  sessionId:string;
  attendance:Attendance|null;
  student:{name:string};
  session:{title:string;startsAt:string};
};
const props=defineProps<{workspaceId:string}>();
const rows=ref<RecordRow[]>([]);
const loading=ref(false),error=ref(''),message=ref(''),busy=ref('');
const selectVersion=ref(0);
let loadVersion=0;
let saveVersion=0;

const sortedRows=computed(()=>[...rows.value].sort((a,b)=>
  new Date(b.session.startsAt).getTime()-new Date(a.session.startsAt).getTime(),
));
const recordedCount=computed(()=>rows.value.filter(row=>row.attendance!==null).length);

function dateTime(value:string){
  return new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
}
function path(workspaceId:string,suffix:string){
  return workspacePath(workspaceId,'/bookings'+suffix);
}

async function load(){
  const version=++loadVersion;
  const currentWorkspace=props.workspaceId;
  loading.value=true;
  error.value='';
  try{
    const records=await apiJson<RecordRow[]>(path(currentWorkspace,'/staff'));
    if(version!==loadVersion)return;
    rows.value=records;
  }catch(e){
    if(version!==loadVersion)return;
    rows.value=[];
    error.value=e instanceof Error?e.message:'No se pudo cargar la asistencia.';
  }finally{
    if(version===loadVersion)loading.value=false;
  }
}

async function save(bookingId:string,value:string|number){
  if(busy.value||loading.value)return;
  if(!['PRESENT','ABSENT','LATE','EXCUSED'].includes(String(value)))return;
  const currentWorkspace=props.workspaceId;
  const operation=++saveVersion;
  busy.value=bookingId;
  error.value='';
  message.value='';
  try{
    await apiJson(path(currentWorkspace,'/'+encodeURIComponent(bookingId)+'/attendance'),'PATCH',{
      attendance:value,
    });
    if(currentWorkspace!==props.workspaceId)return;
    await load();
    message.value='Asistencia guardada correctamente.';
  }catch(e){
    if(currentWorkspace!==props.workspaceId)return;
    error.value=e instanceof Error?e.message:'No pudimos guardar la asistencia.';
    // Restore the saved server value; a failed selection must not appear persisted.
    selectVersion.value++;
  }finally{
    if(operation===saveVersion)busy.value='';
  }
}

watch(()=>props.workspaceId,()=>{
  ++loadVersion;
  ++saveVersion;
  rows.value=[];
  error.value='';
  message.value='';
  busy.value='';
  void load();
});
onMounted(()=>void load());
</script>

<template>
  <UiCard class="mt-6">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <ClipboardCheck :size="21" aria-hidden="true"/>
          </div>
          <div>
            <h2 class="text-lg font-extrabold">Registro de asistencia</h2>
            <p class="mt-1 max-w-lg text-xs leading-5 text-muted">
              Marca la asistencia de estudiantes con reserva confirmada. Cada docente solo ve sus clases.
            </p>
          </div>
        </div>
        <UiButton variant="secondary" size="sm" :loading="loading" :disabled="!!busy" @click="load">
          <RefreshCcw :size="15" aria-hidden="true"/> Actualizar
        </UiButton>
      </div>
    </template>
    <UiAlert v-if="error" tone="danger" class="mb-4">{{error}}</UiAlert>
    <UiAlert v-if="message" tone="success" class="mb-4">{{message}}</UiAlert>
    <div v-if="!loading && rows.length" class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-live="polite">
      <span class="inline-flex items-center gap-1.5"><UsersRound :size="14" aria-hidden="true"/>{{rows.length}} reservas confirmadas</span>
      <span>{{recordedCount}} con asistencia registrada</span>
      <span>{{rows.length-recordedCount}} pendientes</span>
    </div>
    <p v-if="loading" class="py-6 text-sm text-muted" role="status">Cargando asistencia…</p>
    <UiEmptyState v-else-if="!rows.length && !error"
      title="Todavía no hay registros de asistencia"
      description="Cuando tus alumnos reserven clases, aparecerán aquí para registrar su asistencia.">
      <template #icon><ClipboardCheck :size="22" aria-hidden="true"/></template>
    </UiEmptyState>
    <div v-else-if="rows.length" class="divide-y divide-outline">
      <div v-for="record in sortedRows" :key="record.id"
        class="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-bold text-ink">{{record.student.name}}</p>
          <p class="mt-1 text-xs leading-5 text-muted">
            {{record.session.title}} · {{dateTime(record.session.startsAt)}}
          </p>
        </div>
        <div class="w-full shrink-0 sm:w-48">
          <label :for="'attendance-'+record.id" class="mb-1 block text-xs font-semibold text-muted sm:sr-only">
            Asistencia de {{record.student.name}}
          </label>
          <UiSelect :key="record.id+':'+selectVersion"
            :id="'attendance-'+record.id"
            :model-value="record.attendance??''"
            :disabled="!!busy"
            @update:model-value="save(record.id,$event)">
            <option value="" disabled>Sin registrar</option>
            <option value="PRESENT">Asistió</option>
            <option value="LATE">Llegó tarde</option>
            <option value="ABSENT">No asistió</option>
            <option value="EXCUSED">Excusado</option>
          </UiSelect>
          <p v-if="busy===record.id" class="mt-1 text-xs text-muted" role="status">Guardando…</p>
        </div>
      </div>
    </div>
  </UiCard>
</template>
