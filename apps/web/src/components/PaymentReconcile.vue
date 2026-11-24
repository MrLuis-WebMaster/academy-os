<script setup lang="ts">
import {ref,watch} from 'vue';
import {RefreshCw} from 'lucide-vue-next';
import {UiButton,UiAlert} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
const props=defineProps<{workspaceId:string;orderId:string;transactionKnown:boolean;initialId?:string}>();
const emit=defineEmits<{updated:[]}>();
const id=ref(props.initialId??''),busy=ref(false),error=ref(''),notice=ref('');
watch(()=>[props.workspaceId,props.orderId,props.initialId],()=>{id.value=props.initialId??'';error.value='';notice.value='';});
async function reconcile(){
 if(busy.value)return;
 const value=id.value.trim();
 if(!props.transactionKnown&&!/^[a-zA-Z0-9_-]{1,128}$/.test(value)){error.value='Indica el ID de la transacción de Wompi.';return;}
 const w=props.workspaceId,order=props.orderId;
 busy.value=true;error.value='';notice.value='';
 try{
  const result=await apiJson<{handled:boolean;resolution:string}>(workspacePath(w,'/package-checkout/'+encodeURIComponent(order)+'/reconcile'),'POST',props.transactionKnown?{}:{transactionId:value});
  if(w!==props.workspaceId||order!==props.orderId)return;
  notice.value=result.resolution==='FULFILLED'?'Pago verificado y créditos entregados.':result.resolution==='TEST_APPROVED'?'Pago de prueba confirmado; sin créditos reales.':result.resolution==='REVIEW_REQUIRED'?'La transacción requiere revisión de la academia.':result.resolution==='NOT_PAID'?'El proveedor informa que el pago no fue aprobado.':'Consulta realizada; verifica el estado actualizado.';
  emit('updated');
 }catch(e){if(w===props.workspaceId&&order===props.orderId)error.value=e instanceof Error?e.message:'No se pudo verificar el pago.';}
 finally{busy.value=false;}
}
</script>
<template>
 <div class="w-full space-y-2 rounded-lg border border-outline p-3">
  <p class="text-xs font-semibold">Consultar pago con Wompi</p>
  <label v-if="!transactionKnown" class="block text-xs text-muted">ID de transacción (no es la referencia de la orden)<input v-model="id" maxlength="128" autocomplete="off" spellcheck="false" class="mt-1 w-full rounded-lg border border-outline bg-surface p-2 text-sm" placeholder="ID que aparece en Wompi"/></label>
  <UiButton type="button" size="sm" variant="secondary" :disabled="busy||(!transactionKnown&&!id.trim())" @click="reconcile"><RefreshCw :size="14"/> Verificar estado</UiButton>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert><UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
 </div>
</template>
