<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {MessageCircleQuestion,Send,RefreshCw} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Referral={
 id:string;courseId:string;studentUserId:string;question:string;
 status:'OPEN'|'RESOLVED';reply:string|null;createdAt:string;resolvedAt:string|null;
 course:{title:string};student:{name:string};
};
const props=defineProps<{workspaceId:string}>();
const records=ref<Referral[]>([]),responses=ref<Record<string,string>>({});
const loading=ref(false),busy=ref(''),error=ref(''),notice=ref('');
const pending=computed(()=>records.value.filter(row=>row.status==='OPEN'));
const resolved=computed(()=>records.value.filter(row=>row.status==='RESOLVED'));
let version=0;
function api<T>(workspaceId:string,path:string,method='GET',body?:unknown){
 return apiJson<T>(workspacePath(workspaceId,'/profe-sos/referrals'+path),method,body);
}
async function load(){
 const workspaceId=props.workspaceId,request=++version;
 loading.value=true;error.value='';records.value=[];
 try{
  const result=await api<Referral[]>(workspaceId,'/staff');
  if(request!==version||workspaceId!==props.workspaceId)return;
  records.value=result;
 }catch(e){
  if(request===version&&workspaceId===props.workspaceId)
   error.value=e instanceof Error?e.message:'No se pudieron consultar las dudas.';
 }finally{if(request===version)loading.value=false;}
}
async function reply(item:Referral){
 if(busy.value)return;
 const message=responses.value[item.id]??'';
 if(message.trim().length<10)return;
 const workspaceId=props.workspaceId;
 busy.value=item.id;error.value='';notice.value='';
 try{
  await api(workspaceId,'/'+encodeURIComponent(item.id)+'/resolve','PATCH',{reply:message});
  if(workspaceId!==props.workspaceId)return;
  delete responses.value[item.id];
  await load();
  if(workspaceId===props.workspaceId)notice.value='Respuesta enviada dentro de AcademyOS.';
 }catch(e){
  if(workspaceId===props.workspaceId)
   error.value=e instanceof Error?e.message:'No se pudo responder la duda.';
 }finally{busy.value='';}
}
watch(()=>props.workspaceId,()=>{++version;busy.value='';responses.value={};notice.value='';void load();});
onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header>
   <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3"><MessageCircleQuestion :size="22" class="text-brand"/><div>
     <h2 class="text-lg font-extrabold">Profe SOS · Dudas pendientes</h2>
     <p class="mt-1 text-xs text-muted">Responde preguntas de tus cursos. No se comparten por correo ni con otros alumnos.</p>
    </div></div>
    <UiButton variant="secondary" size="sm" :disabled="loading" @click="load"><RefreshCw :size="14"/> Actualizar</UiButton>
   </div>
  </template>
  <p v-if="loading" class="text-xs text-muted">Buscando dudas…</p>
  <div v-else class="space-y-4">
   <p class="text-sm font-bold">{{pending.length}} {{pending.length===1?'pregunta por atender':'preguntas por atender'}}</p>
   <p v-if="!pending.length" class="text-sm text-muted">No hay dudas abiertas en tus cursos.</p>
   <article v-for="record in pending" :key="record.id" class="rounded-xl border border-outline p-4">
    <p class="text-xs font-semibold text-brand">{{record.course.title}} · {{record.student.name}}</p>
    <p class="mt-2 whitespace-pre-wrap text-sm leading-6">{{record.question}}</p>
    <p class="mt-2 text-xs text-muted">{{new Date(record.createdAt).toLocaleString('es-CO')}}</p>
    <form class="mt-4 space-y-3" @submit.prevent="reply(record)">
     <label class="block text-xs font-semibold">Respuesta del docente
      <textarea v-model="responses[record.id]" required minlength="10" maxlength="1500" rows="3"
       placeholder="Da una pista, explica el siguiente paso o sugiere un ejercicio."
       class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea>
     </label>
     <UiButton type="submit" size="sm" :loading="busy===record.id" :disabled="Boolean(busy)||(responses[record.id]?.trim().length??0)<10"><Send :size="14"/> Enviar respuesta</UiButton>
    </form>
   </article>
   <details v-if="resolved.length" class="rounded-xl border border-outline p-4">
    <summary class="cursor-pointer text-sm font-bold">Resueltas ({{resolved.length}})</summary>
    <div v-for="record in resolved" :key="record.id" class="mt-4 border-t border-outline pt-3">
     <p class="text-xs font-semibold">{{record.course.title}} · {{record.student.name}}</p>
     <p class="mt-2 text-xs">{{record.question}}</p>
     <p class="mt-1 text-xs font-medium text-brand">Respuesta: {{record.reply}}</p>
    </div>
   </details>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-4">{{notice}}</UiAlert>
 </UiCard>
</template>
