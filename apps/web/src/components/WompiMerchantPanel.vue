<script setup lang="ts">
import {onMounted,ref,watch,computed} from 'vue';
import {ShieldCheck,Copy} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
type Status={configured:boolean;acceptingPayments:boolean;available:boolean;environment:'test';webhookPath:string};
const props=defineProps<{workspaceId:string}>();
const status=ref<Status|null>(null),loading=ref(false),busy=ref(false),error=ref(''),notice=ref('');
const publicKey=ref(''),privateKey=ref(''),integrityKey=ref(''),eventsKey=ref('');
const webhookUrl=computed(()=>status.value?new URL(status.value.webhookPath,window.location.origin).toString():'');
let version=0;
const path=(w:string)=>workspacePath(w,'/wompi-merchant');
function clear(){publicKey.value='';privateKey.value='';integrityKey.value='';eventsKey.value='';}
async function load(){
 const w=props.workspaceId,n=++version;loading.value=true;status.value=null;error.value='';
 try{const result=await apiJson<Status>(path(w));if(n===version&&w===props.workspaceId)status.value=result;}
 catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo consultar la configuración.';}
 finally{if(n===version)loading.value=false;}
}
async function configure(){
 if(busy.value||!status.value?.available)return;
 if(!window.confirm('¿Guardar las credenciales sandbox de esta academia? Las nuevas compras quedarán pausadas hasta que las habilites.'))return;
 const w=props.workspaceId;busy.value=true;error.value='';notice.value='';
 try{
  const result=await apiJson<Status>(path(w),'PUT',{publicKey:publicKey.value.trim(),privateKey:privateKey.value.trim(),integrityKey:integrityKey.value.trim(),eventsKey:eventsKey.value.trim()});
  if(w===props.workspaceId){status.value=result;notice.value='Configuración guardada. Registra el webhook de sandbox en Wompi antes de habilitar las compras.';}
 }catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo guardar.';}
 finally{if(w===props.workspaceId)clear();busy.value=false;}
}
async function toggle(){
 if(busy.value||!status.value?.configured||!status.value.available)return;
 const accepting=!status.value.acceptingPayments,w=props.workspaceId;
 if(!window.confirm(accepting?'¿Habilitar compras de prueba? Confirma que registraste el webhook sandbox. No se cobra dinero real.':'¿Pausar nuevas compras? Las transacciones existentes se seguirán verificando.'))return;
 busy.value=true;error.value='';notice.value='';
 try{const result=await apiJson<Status>(path(w)+'/accepting','PATCH',{accepting});if(w===props.workspaceId){status.value=result;notice.value=accepting?'Compras sandbox habilitadas.':'Nuevas compras pausadas.';}}
 catch(e){if(w===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo cambiar el estado.';}
 finally{busy.value=false;}
}
async function copy(){try{await navigator.clipboard.writeText(webhookUrl.value);notice.value='URL copiada.';}catch{error.value='No se pudo copiar; selecciona la URL manualmente.';}}
watch(()=>props.workspaceId,()=>{clear();notice.value='';void load();});onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><ShieldCheck :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Cuenta comercial Wompi</h2><p class="text-xs text-muted">Configuración independiente de tu academia.</p></div></div></template>
  <p v-if="loading" role="status" class="text-xs text-muted">Consultando configuración…</p>
  <UiAlert v-if="status&&!status.available" tone="warning">La configuración por academia todavía no está disponible en esta instalación o este espacio utiliza el comercio piloto.</UiAlert>
  <template v-if="status?.available">
   <UiAlert tone="warning">Solo sandbox. No ingreses credenciales de producción. Las credenciales se guardan cifradas y no se vuelven a mostrar. No se ha comprobado la conexión real.</UiAlert>
   <p class="text-sm font-bold">{{status.configured?'Cuenta configurada':'Sin configurar'}} · {{status.acceptingPayments?'Compras de prueba habilitadas':'Compras pausadas'}}</p>
   <form class="grid gap-3 sm:grid-cols-2" autocomplete="off" @submit.prevent="configure">
    <label class="text-xs font-semibold">Llave pública<input v-model="publicKey" type="password" required maxlength="512" autocomplete="off" placeholder="pub_test_…" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3"/></label>
    <label class="text-xs font-semibold">Llave privada<input v-model="privateKey" type="password" required maxlength="512" autocomplete="new-password" placeholder="prv_test_…" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3"/></label>
    <label class="text-xs font-semibold">Secreto de integridad<input v-model="integrityKey" type="password" required maxlength="512" autocomplete="new-password" placeholder="test_integrity_…" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3"/></label>
    <label class="text-xs font-semibold">Secreto de eventos<input v-model="eventsKey" type="password" required maxlength="512" autocomplete="new-password" placeholder="test_events_…" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3"/></label>
    <UiButton type="submit" :disabled="busy">Guardar credenciales sandbox</UiButton>
   </form>
   <p class="text-xs text-muted">Para evitar perder la posibilidad de conciliar pagos, no se permite cambiar las credenciales cuando ya existe historial de checkout.</p>
   <template v-if="status.configured">
    <label class="block text-xs font-semibold">URL de eventos para registrar en Wompi<input readonly :value="webhookUrl" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-xs"/></label>
    <div class="flex flex-wrap gap-2"><UiButton variant="secondary" size="sm" @click="copy"><Copy :size="14"/> Copiar URL</UiButton><UiButton size="sm" :disabled="busy" @click="toggle">{{status.acceptingPayments?'Pausar compras':'Habilitar compras sandbox'}}</UiButton></div>
   </template>
  </template>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </UiCard>
</template>
