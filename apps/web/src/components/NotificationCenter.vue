<script setup lang="ts">
import {ref,watch} from 'vue';
import {Bell,Check,CheckCheck,RefreshCcw} from 'lucide-vue-next';
import {UiBadge,UiButton,UiEmptyState} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Notice={
 id:string;kind:'SESSION_CANCELLED'|'SESSION_RESCHEDULED';
 title:string;body:string;sessionId:string|null;createdAt:string;readAt:string|null;
};
type Inbox={items:Notice[];unreadCount:number};
const props=defineProps<{workspaceId:string}>();
const inbox=ref<Inbox>({items:[],unreadCount:0});
const open=ref(false),loading=ref(false),busy=ref(false),error=ref('');
async function refresh(){
 const workspace=props.workspaceId;
 if(!workspace)return;
 loading.value=true;error.value='';
 try{
  const result=await apiJson<Inbox>(workspacePath(workspace,'/notifications'));
  if(workspace===props.workspaceId)inbox.value=result;
 }catch(e){
  if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No pudimos consultar los avisos.';
 }finally{if(workspace===props.workspaceId)loading.value=false;}
}
async function markRead(id:string){
 busy.value=true;error.value='';
 try{
  await apiJson(workspacePath(props.workspaceId,'/notifications/'+encodeURIComponent(id)+'/read'),'PATCH');
  await refresh();
 }catch(e){error.value=e instanceof Error?e.message:'No pudimos marcar el aviso como leído.';}
 finally{busy.value=false;}
}
async function markAll(){
 busy.value=true;error.value='';
 try{
  await apiJson(workspacePath(props.workspaceId,'/notifications/read-all'),'POST');
  await refresh();
 }catch(e){error.value=e instanceof Error?e.message:'No pudimos marcar los avisos como leídos.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{
 inbox.value={items:[],unreadCount:0};open.value=false;error.value='';
 void refresh();
},{immediate:true});
function toggle(){open.value=!open.value;if(open.value)void refresh();}
</script>
<template>
 <div class="relative">
  <button type="button" class="relative grid size-10 place-items-center rounded-xl border border-outline bg-surface text-ink hover:bg-surface-muted"
    :aria-expanded="open" aria-controls="academy-notification-panel" :aria-label="'Notificaciones'+(inbox.unreadCount?' ('+inbox.unreadCount+' sin leer)':'')"
    title="Notificaciones" @click="toggle">
    <Bell :size="19" aria-hidden="true"/>
    <span v-if="inbox.unreadCount" class="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white"
      aria-hidden="true">{{inbox.unreadCount>99?'99+':inbox.unreadCount}}</span>
  </button>
  <div v-if="open" id="academy-notification-panel"
    role="region" aria-label="Bandeja de notificaciones"
    class="absolute right-0 top-12 z-50 w-[min(92vw,26rem)] overflow-hidden rounded-2xl border border-outline bg-surface text-ink shadow-[var(--ao-shadow)]">
    <div class="flex items-center justify-between gap-3 border-b border-outline p-4">
      <div class="flex items-center gap-2"><h2 class="text-sm font-extrabold">Notificaciones</h2><UiBadge v-if="inbox.unreadCount" tone="brand">{{inbox.unreadCount}} nuevas</UiBadge></div>
      <div class="flex gap-1">
        <button type="button" class="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-muted" aria-label="Actualizar notificaciones" :disabled="loading" @click="refresh"><RefreshCcw :size="16"/></button>
        <button v-if="inbox.unreadCount" type="button" class="grid size-9 place-items-center rounded-lg text-brand hover:bg-brand-soft"
          aria-label="Marcar todas como leídas" :disabled="busy" @click="markAll"><CheckCheck :size="18"/></button>
      </div>
    </div>
    <div class="max-h-[min(65dvh,26rem)] overflow-y-auto p-3">
      <p v-if="error" role="alert" class="mb-3 rounded-lg bg-danger-soft p-3 text-xs text-danger">{{error}}</p>
      <p v-if="loading" class="p-3 text-xs text-muted">Actualizando avisos...</p>
      <UiEmptyState v-else-if="!inbox.items.length" title="Todo al día" description="Aquí aparecerán los cambios de tus clases y reservas.">
        <template #icon><Bell :size="22"/></template>
      </UiEmptyState>
      <div v-else class="space-y-2">
        <article v-for="notice in inbox.items" :key="notice.id" class="rounded-xl border border-outline p-3" :class="notice.readAt?'bg-surface':'bg-brand-soft'">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-bold">{{notice.title}}</p>
              <p class="mt-1 text-xs leading-5 text-muted">{{notice.body}}</p>
            </div>
            <button v-if="!notice.readAt" type="button" class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-brand"
              aria-label="Marcar aviso como leído" :disabled="busy" @click="markRead(notice.id)"><Check :size="16"/></button>
          </div>
          <p class="mt-2 text-[11px] text-muted">{{new Date(notice.createdAt).toLocaleString('es-CO')}}</p>
        </article>
      </div>
    </div>
    <p class="border-t border-outline px-4 py-3 text-xs text-muted">Los avisos se muestran dentro de AcademyOS. Los correos y WhatsApp aún no están conectados.</p>
  </div>
 </div>
</template>
