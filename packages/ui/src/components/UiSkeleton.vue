<script setup lang="ts">
withDefaults(defineProps<{width?:string;height?:string;rounded?:boolean}>(),{width:'100%',height:'1rem',rounded:true});
</script>
<template>
 <span aria-hidden="true" class="block animate-pulse bg-surface-muted" :class="rounded?'rounded-xl':'rounded-sm'" :style="{width,height}"/>
</template>
