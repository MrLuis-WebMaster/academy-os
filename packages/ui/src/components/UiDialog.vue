<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {X} from 'lucide-vue-next';
const model=defineModel<boolean>('open',{default:false});
const props=withDefaults(defineProps<{title:string;description?:string}>(),{});
const dialog=ref<HTMLDialogElement|null>(null);
function sync(){
  const element=dialog.value;
  if(!element)return;
  if(model.value && !element.open)element.showModal();
  if(!model.value && element.open)element.close();
}
function close(){model.value=false;}
onMounted(sync);
watch(model,sync,{flush:'post'});
</script>
<template>
 <dialog ref="dialog" @cancel="close" @close="close"
  class="fixed inset-0 m-auto w-[min(calc(100%-2rem),34rem)] max-h-[85dvh] overflow-y-auto rounded-2xl border border-outline bg-surface p-0 text-ink shadow-[var(--ao-shadow)] backdrop:bg-[#070815]/70">
  <div class="flex items-start justify-between gap-3 border-b border-outline p-5">
   <div><h2 class="text-lg font-extrabold">{{ title }}</h2><p v-if="description" class="mt-1 text-xs text-muted">{{ description }}</p></div>
   <button type="button" class="grid size-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-muted" aria-label="Cerrar diálogo" @click="close"><X :size="18"/></button>
  </div>
  <div class="p-5"><slot :close="close"/></div>
  <div v-if="$slots.footer" class="border-t border-outline p-5"><slot name="footer" :close="close"/></div>
 </dialog>
</template>
