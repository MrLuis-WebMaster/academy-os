<script setup lang="ts">
import { computed } from 'vue';
const props=withDefaults(defineProps<{
  padding?:'none'|'sm'|'md'|'lg';
  elevated?:boolean;
}>(),{padding:'md',elevated:false});
const paddingClass=computed(()=>({none:'',sm:'p-4',md:'p-5 sm:p-6',lg:'p-6 sm:p-9'}[props.padding]));
</script>
<template>
  <section class="rounded-2xl border border-outline bg-surface" :class="[paddingClass,elevated?'shadow-[var(--ao-shadow)]':'']">
    <header v-if="$slots.header" class="mb-5"><slot name="header"/></header>
    <slot/>
    <footer v-if="$slots.footer" class="mt-5 border-t border-outline pt-4"><slot name="footer"/></footer>
  </section>
</template>
