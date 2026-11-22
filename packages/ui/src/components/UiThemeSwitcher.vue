<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next';
import { useTheme } from '../theme.js';
import type { ThemePreference } from '../theme.js';
const {preference,setTheme}=useTheme();
const options: {value:ThemePreference;title:string;icon:typeof Sun}[]=[
  {value:'light',title:'Tema claro',icon:Sun},
  {value:'dark',title:'Tema oscuro',icon:Moon},
  {value:'system',title:'Automático según el sistema',icon:Monitor},
];
</script>
<template>
  <div class="inline-flex items-center rounded-xl border border-outline bg-surface-muted p-1" role="group" aria-label="Tema de apariencia">
    <button v-for="option in options" :key="option.value" type="button"
      class="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:text-ink"
      :class="preference===option.value?'bg-surface text-brand shadow-sm':''"
      :aria-label="option.title" :aria-pressed="preference===option.value" :title="option.title"
      @click="setTheme(option.value)">
      <component :is="option.icon" :size="17" aria-hidden="true"/>
    </button>
  </div>
</template>
