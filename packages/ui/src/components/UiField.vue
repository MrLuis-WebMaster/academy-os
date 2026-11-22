<script setup lang="ts">
import { useId } from 'vue';
const props=defineProps<{label:string;for?:string;hint?:string;error?:string;required?:boolean}>();
const uniqueId=useId();
</script>
<template>
  <div class="min-w-0">
    <label :for="props.for||uniqueId" class="mb-2 block text-xs font-semibold text-ink">{{ label }}<span v-if="required" class="ml-1 text-danger" aria-label="obligatorio">*</span></label>
    <slot :id="props.for||uniqueId" :described-by="hint||error?uniqueId+'-hint':undefined"/>
    <p v-if="error" :id="uniqueId+'-hint'" role="alert" class="mt-1 text-xs text-danger">{{ error }}</p>
    <p v-else-if="hint" :id="uniqueId+'-hint'" class="mt-1 text-xs text-muted">{{ hint }}</p>
  </div>
</template>
