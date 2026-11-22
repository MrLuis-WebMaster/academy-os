<script setup lang="ts">
import {computed} from 'vue';
import {AlertCircle,CheckCircle2,Info,AlertTriangle} from 'lucide-vue-next';
const props=withDefaults(defineProps<{tone?:'info'|'success'|'warning'|'danger';title?:string}>(),{tone:'info'});
const color=computed(()=>({
 info:'border-outline bg-brand-soft text-ink',
 success:'border-success/30 bg-success-soft text-success',
 warning:'border-warning/30 bg-warning-soft text-warning',
 danger:'border-danger/30 bg-danger-soft text-danger',
}[props.tone]));
const icon=computed(()=>({info:Info,success:CheckCircle2,warning:AlertTriangle,danger:AlertCircle})[props.tone]);
</script>
<template>
 <div :role="tone==='danger'?'alert':'status'" class="flex items-start gap-3 rounded-xl border p-3 text-sm" :class="color">
  <component :is="icon" :size="18" class="mt-0.5 shrink-0" aria-hidden="true"/>
  <div class="min-w-0"><p v-if="title" class="font-bold">{{ title }}</p><div class="leading-6"><slot/></div></div>
 </div>
</template>
