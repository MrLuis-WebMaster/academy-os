<script setup lang="ts">
import { computed } from 'vue';
const props=withDefaults(defineProps<{tone?:'neutral'|'success'|'warning'|'danger'|'brand'}>(),{tone:'neutral'});
const color=computed(()=>({
  neutral:'bg-surface-muted text-muted',
  success:'bg-success-soft text-success',
  warning:'bg-warning-soft text-warning',
  danger:'bg-danger-soft text-danger',
  brand:'bg-brand-soft text-brand',
}[props.tone]));
</script>
<template><span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" :class="color"><slot/></span></template>
