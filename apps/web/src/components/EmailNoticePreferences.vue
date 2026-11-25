<script setup lang="ts">
import {ref,onMounted,watch} from 'vue';
import {Mail} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
const props=defineProps<{workspaceId:string}>();
type Preference={enabled:boolean;available:boolean};
const state=ref<Preference|null>(null),busy=ref(false),loading=ref(false),error=ref(''),notice=ref('');
let generation=0;
const path=(w:string)=>workspacePath(w,'/notifications/email-preferences');
async function load(){
 const w=props.workspaceId,n=++generation;state.value=null;loading.value=true;error.value='';
 try{const result=await apiJson<Preference>(path(w));if(n===generation&&w===props.workspaceId)state.value=result;}
 catch(e){if(n===generation)error.value=e instanceof Error?e.message:'No se pudieron consultar las preferencias.';}
 finally{if(n===generation)loading.value=false;}
}
async function toggle(){
 if(!state.value||busy.value)return;
 const enabled=!state.value.enabled,w=props.workspaceId;
 if(enabled&&!state.value.available)return;
 if(enabled&&!window.confirm('¿Recibir avisos académicos por correo en tu dirección verificada? Puedes desactivarlos cuando quieras.'))return;
 busy.value=true;error.value='';notice.value='';
 try{const result=await apiJson<Preference>(path(w),'PATCH',{enabled});if(w===props.workspaceId){state.value=result;notice.value=enabled?'Preferencia guardada. Solo se enviarán nuevos avisos elegibles.':'Correos desactivados para esta academia.';}}
 catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo guardar la preferencia.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{notice.value='';void load();});onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><Mail :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Avisos por correo</h2><p class="text-xs text-muted">Preferencia independiente para esta academia.</p></div></div></template>
  <p v-if="loading" role="status" class="text-xs text-muted">Consultando…</p>
  <template v-if="state">
   <p class="text-sm">Recibe avisos de inscripciones, reservas, cambios y recordatorios habilitados en tu correo verificado. Los detalles permanecen en tu Aula Digital.</p>
   <p class="text-xs text-muted">Estado: {{state.enabled?'Activado':'Desactivado'}}. No se envían mensajes promocionales.</p>
   <UiAlert v-if="!state.available" tone="warning">El servicio de correo aún no está habilitado en esta instalación. Puedes retirar una autorización existente.</UiAlert>
   <UiButton size="sm" :disabled="busy||(!state.available&&!state.enabled)" @click="toggle">{{state.enabled?'Desactivar correo':'Activar correo'}}</UiButton>
  </template>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </UiCard>
</template>
