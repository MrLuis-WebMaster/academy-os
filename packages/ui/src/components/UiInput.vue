<script setup lang="ts">
const model=defineModel<string|number>({default:''});
withDefaults(defineProps<{
  id?:string;type?:'text'|'email'|'url'|'search'|'password'|'number'|'date'|'time';
  placeholder?:string;required?:boolean;disabled?:boolean;autocomplete?:string;
  min?:number;max?:number;minlength?:number;maxlength?:number;
  describedBy?:string;invalid?:boolean;
}>(),{type:'text',required:false,disabled:false,invalid:false});
function handle(event:Event){
  const element=event.target as HTMLInputElement;
  model.value=element.type==='number'&&element.value!==''?element.valueAsNumber:element.value;
}
</script>
<template>
 <input :id="id" :type="type" :value="model" :placeholder="placeholder" :required="required"
   :disabled="disabled" :autocomplete="autocomplete" :min="min" :max="max" :minlength="minlength" :maxlength="maxlength"
   :aria-describedby="describedBy" :aria-invalid="invalid"
   class="min-h-11 w-full min-w-0 rounded-xl border border-outline bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
   @input="handle"/>
</template>
