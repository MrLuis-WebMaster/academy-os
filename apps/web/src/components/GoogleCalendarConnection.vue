<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {CalendarDays,RefreshCw} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Lesson={id:string;title:string;startsAt:string;status:string;mode:string};
const props=defineProps<{workspaceId:string;sessions:Lesson[]}>();
const emit=defineEmits<{updated:[]}>();
const selectedId=ref(''),createMeet=ref(false),publishMeet=ref(false),autoSync=ref(false),meetUrl=ref<string|null>(null);
const syncState=ref<{enabled:boolean;pending:boolean;lastErrorCode:string|null}|null>(null),syncLoading=ref(false);
let syncVersion=0;
const exportable=computed(()=>props.sessions.filter(s=>['CONFIRMED','CANCELLED'].includes(s.status)));
const selected=computed(()=>exportable.value.find(s=>s.id===selectedId.value));
watch(selectedId,()=>{createMeet.value=false;publishMeet.value=false;autoSync.value=false;meetUrl.value=null;void loadSync();});
watch(createMeet,value=>{if(!value)publishMeet.value=false;});

type Status={configured:boolean;connected:boolean;connectedAt:string|null};
const status=ref<Status|null>(null),loading=ref(false),busy=ref(false),error=ref(''),notice=ref('');
let version=0;
function path(workspace:string,suffix=''){return workspacePath(workspace,'/integrations/google-calendar'+suffix);}
async function refresh(){
 const workspace=props.workspaceId,n=++version;
 status.value=null;loading.value=true;error.value='';
 try{const result=await apiJson<Status>(path(workspace),'GET');
  if(n===version&&workspace===props.workspaceId){status.value=result;await loadSync();}
 }catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo consultar la conexión.';}
 finally{if(n===version)loading.value=false;}
}
async function loadSync(){
 const n=++syncVersion,workspace=props.workspaceId,id=selectedId.value;
 syncState.value=null;autoSync.value=false;
 if(!id||!status.value?.connected){syncLoading.value=false;return;}
 syncLoading.value=true;
 try{
  const state=await apiJson<{enabled:boolean;pending:boolean;lastErrorCode:string|null}>(path(workspace,'/classes/'+encodeURIComponent(id)+'/sync'),'GET');
  if(n===syncVersion&&workspace===props.workspaceId&&id===selectedId.value){syncState.value=state;autoSync.value=state.enabled;}
 }catch(e){if(n===syncVersion)error.value=e instanceof Error?e.message:'No se pudo consultar la sincronización.';}
 finally{if(n===syncVersion)syncLoading.value=false;}
}
async function stopSync(){
 const id=selectedId.value,workspace=props.workspaceId;
 if(!id||busy.value||!syncState.value?.enabled)return;
 if(!window.confirm('¿Detener las actualizaciones automáticas de esta clase? El evento de Google no se borrará. Una petición que ya esté en curso podría finalizar.'))return;
 busy.value=true;error.value='';notice.value='';
 try{
  await apiJson(path(workspace,'/classes/'+encodeURIComponent(id)+'/sync'),'DELETE');
  if(workspace===props.workspaceId&&id===selectedId.value){await loadSync();notice.value='Sincronización automática detenida.';}
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo detener la sincronización.';}
 finally{busy.value=false;}
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
 if(!lesson||busy.value||syncLoading.value||!syncState.value||!status.value?.connected||!status.value?.configured)return;
 const action=lesson.status==='CANCELLED'?'Eliminar el evento asociado de tu calendario':'Enviar el título y horario de la clase a tu calendario privado';
 if(!window.confirm(action+'? El título se enviará tal como está escrito; comprueba que no incluya datos personales. No se adjuntan listas de alumnos ni notas.'+(publishMeet.value?' También reemplazarás el enlace de la clase por el de Meet para los alumnos con reserva.':'')+(autoSync.value&&lesson.status==='CONFIRMED'?' Autorizas futuros cambios de título, fecha y cancelación de esta clase en Google.':'')))return;
 const workspace=props.workspaceId;busy.value=true;error.value='';notice.value='';meetUrl.value=null;
 try{
  const result=await apiJson<{state:'saved'|'removed';meetUrl:string|null;conferencePending:boolean;meetPublished:boolean}>(path(workspace,'/classes/'+encodeURIComponent(lesson.id)+'/export'),'POST',{createMeet:createMeet.value,publishMeet:publishMeet.value,autoSync:autoSync.value&&lesson.status==='CONFIRMED'});
  if(workspace!==props.workspaceId)return;
  notice.value=result.state==='removed'?'Evento eliminado o ya ausente.':result.conferencePending?'Evento guardado. Google está preparando la reunión; vuelve a sincronizar para consultar el enlace.':'Evento guardado en Google Calendar.';
  await loadSync();
  if(workspace!==props.workspaceId)return;
  if(result.meetPublished){notice.value='Enlace Meet publicado en la clase para alumnos con reserva.';emit('updated');}
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
   <p class="text-xs text-muted">Puedes enviar clases individualmente a tu calendario principal y actualizar o retirar eventos ya exportados. Puedes autorizar actualizaciones automáticas por clase y publicar el enlace Meet mediante una autorización explícita. El worker debe estar habilitado en el servidor.</p>
   <div class="flex flex-wrap gap-2">
    <UiButton v-if="status.configured" :disabled="busy" @click="connect">{{status.connected?'Volver a autorizar':'Conectar Google Calendar'}}</UiButton>
    <UiButton v-if="status.connected" variant="secondary" :disabled="busy" @click="disconnect">Desconectar</UiButton>
   </div>
   <form v-if="status.connected" class="space-y-3 rounded-xl border border-outline p-3" @submit.prevent="exportClass">
    <label class="block text-xs font-semibold">Clase
     <select v-model="selectedId" :disabled="busy" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
      <option value="">Selecciona una clase</option>
      <option v-for="lesson in exportable" :key="lesson.id" :value="lesson.id">{{lesson.title}} · {{new Date(lesson.startsAt).toLocaleString('es-CO')}} · {{lesson.status}}</option>
     </select>
    </label>
    <label v-if="selected&&selected.mode!=='ONSITE'&&selected.status==='CONFIRMED'" class="flex items-center gap-2 text-xs"><input v-model="createMeet" type="checkbox" :disabled="busy"/> Solicitar enlace Google Meet</label>
    <label v-if="createMeet&&selected?.status==='CONFIRMED'" class="flex items-center gap-2 text-xs"><input v-model="publishMeet" type="checkbox" :disabled="busy"/> Publicar o reemplazar enlace de clase para alumnos con reserva</label>
    <div v-if="selected" class="space-y-2">
     <p v-if="syncLoading" class="text-xs text-muted">Consultando sincronización…</p>
     <label v-else-if="selected.status==='CONFIRMED'&&status.configured" class="flex items-center gap-2 text-xs"><input v-model="autoSync" type="checkbox" :disabled="busy"/> Sincronizar automáticamente los futuros cambios de esta clase</label>
     <p v-if="syncState?.enabled" class="text-xs text-muted">{{syncState.lastErrorCode?'La sincronización necesita revisión.':syncState.pending?'Hay cambios pendientes de enviar.':'Sincronización automática autorizada.'}}</p>
     <UiButton v-if="syncState?.enabled" type="button" size="sm" variant="secondary" :disabled="busy||syncLoading" @click="stopSync">Detener sincronización</UiButton>
    </div>
    <UiButton type="submit" :disabled="busy||syncLoading||!syncState||!selected||!status.configured">{{selected?.status==='CANCELLED'?'Retirar evento':'Exportar / actualizar evento'}}</UiButton>
    <p v-if="meetUrl" class="break-all text-xs"><a :href="meetUrl" target="_blank" rel="noopener noreferrer" class="text-brand underline">{{meetUrl}}</a></p>
   </form>
   <a v-if="status.connected" href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer" class="text-xs text-brand underline">Gestionar permisos en Google</a>
  </div>
  <UiButton size="sm" variant="ghost" :disabled="busy||loading" @click="refresh"><RefreshCw :size="14"/> Actualizar estado</UiButton>
  <UiAlert v-if="error" tone="danger" class="mt-3">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-3">{{notice}}</UiAlert>
 </UiCard>
</template>
