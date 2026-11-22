<script setup lang="ts">
const model=defineModel<boolean>({default:false});
withDefaults(defineProps<{label:string;description?:string;disabled?:boolean}>(),{disabled:false});
</script>
<template>
  <div class="flex items-center justify-between gap-4">
    <div class="min-w-0"><p class="text-sm font-semibold text-ink">{{ label }}</p><p v-if="description" class="mt-1 text-xs text-muted">{{ description }}</p></div>
    <button type="button" role="switch" :aria-label="label" :aria-checked="model"
      :disabled="disabled" class="relative h-7 w-12 shrink-0 rounded-full border border-outline transition-colors disabled:opacity-50"
      :class="model?'bg-brand':'bg-surface-muted'" @click="model=!model">
      <span class="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform" :class="model?'translate-x-5':'translate-x-0'"/>
    </button>
  </div>
</template>
