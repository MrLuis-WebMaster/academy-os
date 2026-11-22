<script setup lang="ts">
const model=defineModel<string>({default:''});
withDefaults(defineProps<{
 id?:string;placeholder?:string;rows?:number;required?:boolean;disabled?:boolean;
 minlength?:number;maxlength?:number;describedBy?:string;invalid?:boolean;
}>(),{rows:3,required:false,disabled:false,invalid:false});
</script>
<template>
 <textarea :id="id" :value="model" :placeholder="placeholder" :rows="rows" :required="required"
   :disabled="disabled" :minlength="minlength" :maxlength="maxlength" :aria-describedby="describedBy" :aria-invalid="invalid"
   class="w-full min-w-0 rounded-xl border border-outline bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
   @input="model=($event.target as HTMLTextAreaElement).value"/>
</template>
