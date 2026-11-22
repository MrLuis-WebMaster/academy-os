<script setup lang="ts">
import {GraduationCap} from 'lucide-vue-next';
withDefaults(defineProps<{href?:string;compact?:boolean}>(),{compact:false});
</script>
<template>
 <component :is="href?'a':'div'" :href="href" class="inline-flex items-center gap-2.5 text-ink">
  <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white"><GraduationCap :size="22" aria-hidden="true"/></span>
  <strong class="text-xl font-extrabold tracking-[-0.05em]">academy<span class="text-brand">.</span>os</strong>
  <span v-if="!compact" class="sr-only">Your academy, your way</span>
 </component>
</template>
