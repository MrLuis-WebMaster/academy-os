<script setup lang="ts">
const model=defineModel<string|number>({default:''});
withDefaults(defineProps<{id?:string;required?:boolean;disabled?:boolean;describedBy?:string;invalid?:boolean}>(),{
 required:false,disabled:false,invalid:false,
});
function onChange(event:Event){model.value=(event.target as HTMLSelectElement).value;}
</script>
<template>
  <select :id="id" :value="model" :disabled="disabled" :required="required"
    :aria-invalid="invalid" :aria-describedby="describedBy"
    class="min-h-11 w-full min-w-0 rounded-xl border border-outline bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
    @change="onChange"><slot/></select>
</template>
