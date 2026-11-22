<script setup lang="ts">
import { computed } from 'vue';
import { LoaderCircle } from 'lucide-vue-next';

const props=withDefaults(defineProps<{
  variant?:'primary'|'secondary'|'ghost'|'danger';
  size?:'sm'|'md'|'lg';
  type?:'button'|'submit'|'reset';
  loading?:boolean;disabled?:boolean;block?:boolean;
}>(),{variant:'primary',size:'md',type:'button',loading:false,disabled:false,block:false});
const classes=computed(()=>{
  const variants={
    primary:'bg-brand text-white hover:bg-brand-dark dark:text-[#141324]',
    secondary:'border border-outline bg-surface text-ink hover:bg-surface-muted',
    ghost:'bg-transparent text-ink hover:bg-surface-muted',
    danger:'bg-danger-soft text-danger hover:brightness-95',
  };
  const sizes={sm:'min-h-9 px-3 text-xs',md:'min-h-11 px-4 text-sm',lg:'min-h-12 px-5 text-base'};
  return [variants[props.variant],sizes[props.size],props.block?'w-full':''];
});
</script>
<template>
  <button :type="type" :disabled="disabled||loading"
    class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold shadow-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="classes">
    <LoaderCircle v-if="loading" :size="16" class="animate-spin" aria-hidden="true"/>
    <slot/>
  </button>
</template>
