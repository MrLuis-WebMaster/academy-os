<script setup lang="ts">
defineProps<{title:string;description?:string}>();
</script>
<template>
  <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline bg-surface p-8 text-center">
    <div v-if="$slots.icon" class="mb-3 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><slot name="icon"/></div>
    <h3 class="text-sm font-bold text-ink">{{ title }}</h3>
    <p v-if="description" class="mt-2 max-w-sm text-xs leading-5 text-muted">{{ description }}</p>
    <div v-if="$slots.actions" class="mt-4"><slot name="actions"/></div>
  </div>
</template>
