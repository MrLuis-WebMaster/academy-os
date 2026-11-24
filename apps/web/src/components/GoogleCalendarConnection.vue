<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {CalendarDays,RefreshCw} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Lesson={id:string;title:string;startsAt:string;status:string;mode:string};
const props=defineProps<{workspaceId:string;sessions:Lesson[]}>();
const selectedId=ref(''),createMeet=ref(false),meetUrl=ref<string|null>(null);
const exportable=computed(()=>props.sessions.filter(s=>['CONFIRMED','CANCELLED'].includes(s.status)));
const selected=computed(()=>exportable.value.find(s=>s.id===selectedId.value));
watch(selectedId,()=>{createMeet.value=false;meetUrl.value=null;});

type Status={configured:boolean;connected:boolean;connectedAt:string|null};
const status=ref<Status|null>(null),loading=ref(false),busy=ref(false),error=ref(''),notice=ref('');
let version=0;
function path(workspace:string,suffix=''){return workspacePath(workspace,'/integrations/google-calendar'+suffix);}
async function refresh(){
 const workspace=props.workspaceId,n=++version;
 status.value=null;loading.value=true;error.value='';
 try{const result=await apiJson<Status>(path(workspace),'GET');
  if(n===version&&workspace===props.workspaceId)status.value=result;
 }catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo consultar la conexión.';}
 finally{if(n===version)loading.value=false;}
}
async function connect(){
 if(busy.value||!status.value?.configured)return;
 const workspace=props.workspaceId;busy.value=true;error.value='';
 try{
  const result=await apiJson<{authorizationUrl:string}>(path(workspace,'/authorize'),'POST');
  if(workspace!==props.workspaceId)return;
  const url=new URL(result.authorizationUrl);
  if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth')throw Error('URL de autorización inválida.');
  window.location.assign(url.toString());
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo iniciar la conexión.';}
 finally{busy.value=false;}
}
async function disconnect(){
 if(busy.value||!status.value?.connected||!window.confirm('¿Desconectar Google Calendar de esta academia? Se eliminarán las credenciales locales. Para retirar también los permisos en Google, visita la configuración de tu cuenta.'))return;
 const workspace=props.workspaceId;busy.value=true;error.value='';notice.value='';
 try{
  await apiJson(path(workspace),'DELETE');
  if(workspace!==props.workspaceId)return;
  await refresh();if(workspace===props.workspaceId)notice.value='Conexión local eliminada.';
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo desconectar.';}
 finally{busy.value=false;}
}
async function exportClass(){
 const lesson=selected.value;
 if(!lesson||busy.value||!status.value?.connected||!status.value?.configured)return;
 const action=lesson.status==='CANCELLED'?'Eliminar el evento asociado de tu calendario':'Enviar el título y horario de la clase a tu calendario privado';
 if(!window.confirm(action+'? No se compartirán nombres ni datos de alumnos.'))return;
 const workspace=props.workspaceId;busy.value=true;error.value='';notice.value='';meetUrl.value=null;
 try{
  const result=await apiJson<{state:'saved'|'removed';meetUrl:string|null;conferencePending:boolean}>(path(workspace,'/classes/'+encodeURIComponent(lesson.id)+'/export'),'POST',{createMeet:createMeet.value});
  if(workspace!==props.workspaceId)return;
  notice.value=result.state==='removed'?'Evento eliminado o ya ausente.':result.conferencePending?'Evento guardado. Google está preparando la reunión; vuelve a sincronizar para consultar el enlace.':'Evento guardado en Google Calendar.';
  if(result.meetUrl&&/^https:\/\/meet\.google\.com\/[A-Za-z0-9-]+$/.test(result.meetUrl))meetUrl.value=result.meetUrl;
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo exportar la clase.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{notice.value='';selectedId.value='';meetUrl.value=null;void refresh();});
onMounted(()=>{void refresh();});
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3">
   <CalendarDays :size="22" class="text-brand"/>
   <div><h2 class="text-lg font-extrabold">Google Calendar</h2>
    <p class="mt-1 text-xs text-muted">Conecta tu propia cuenta para esta academia. Es independiente del inicio de sesión.</p>
   </div>
  </div></template>
  <p v-if="loading" class="text-sm text-muted" role="status">Consultando conexión…</p>
  <div v-else-if="status" class="space-y-3">
   <UiAlert v-if="!status.configured" tone="warning">La integración está deshabilitada en el servidor. No se puede iniciar una nueva autorización.</UiAlert>
   <p v-if="status.connected" class="text-sm font-semibold text-success">Cuenta autorizada localmente el {{status.connectedAt?new Date(status.connectedAt).toLocaleDateString('es-CO'):'día registrado'}}.</p>
   <p v-else class="text-sm text-muted">Todavía no hay una conexión guardada.</p>
   <p class="text-xs text-muted">Puedes enviar clases individualmente a tu calendario principal y actualizar o retirar eventos ya exportados. No hay sincronización automática; un enlace Meet generado no se publica a estudiantes automáticamente.</p>
   <div class="flex flex-wrap gap-2">
    <UiButton v-if="status.configured" :disabled="busy" @click="connect">{{status.connected?'Volver a autorizar':'Conectar Google Calendar'}}</UiButton>
    <UiButton v-if="status.connected" variant="secondary" :disabled="busy" @click="disconnect">Desconectar</UiButton>
   </div>
   <form v-if="status.connected&&status.configured" class="space-y-3 rounded-xl border border-outline p-3" @submit.prevent="exportClass">
    <label class="block text-xs font-semibold">Clase
     <select v-model="selectedId" :disabled="busy" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
      <option value="">Selecciona una clase</option>
      <option v-for="lesson in exportable" :key="lesson.id" :value="lesson.id">{{lesson.title}} · {{new Date(lesson.startsAt).toLocaleString('es-CO')}} · {{lesson.status}}</option>
     </select>
    </label>
    <label v-if="selected&&selected.mode!=='ONSITE'&&selected.status==='CONFIRMED'" class="flex items-center gap-2 text-xs"><input v-model="createMeet" type="checkbox" :disabled="busy"/> Solicitar enlace Google Meet</label>
    <UiButton type="submit" :disabled="busy||!selected">{{selected?.status==='CANCELLED'?'Retirar evento':'Exportar / actualizar evento'}}</UiButton>
    <p v-if="meetUrl" class="break-all text-xs"><a :href="meetUrl" target="_blank" rel="noopener noreferrer" class="text-brand underline">{{meetUrl}}</a></p>
   </form>
   <a v-if="status.connected" href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer" class="text-xs text-brand underline">Gestionar permisos en Google</a>
  </div>
  <UiButton size="sm" variant="ghost" :disabled="busy||loading" @click="refresh"><RefreshCw :size="14"/> Actualizar estado</UiButton>
  <UiAlert v-if="error" tone="danger" class="mt-3">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-3">{{notice}}</UiAlert>
 </UiCard>
</template>
