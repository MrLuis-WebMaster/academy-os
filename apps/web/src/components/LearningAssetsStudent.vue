<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {BookOpenCheck,ChevronLeft,ChevronRight,Layers3,RotateCcw,CheckCircle2} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
type Card={front:string;back:string};
type Flash={cards:Card[]};
type Micro={summary:string;steps:Array<{heading:string;body:string}>;reviewPrompt?:string};
type Asset={
 id:string;kind:'FLASHCARDS'|'MICROLESSON';title:string;content:Flash|Micro;
 publishedAt:string;reflection:{sessionId:string;status:string;session:{title:string;courseId:string|null}};
};
const props=defineProps<{workspaceId:string}>();
const assets=ref<Asset[]>([]),loading=ref(true),error=ref('');
const positions=ref<Record<string,number>>({});
const flips=ref<Record<string,boolean>>({});
const ratings=ref<Record<string,'known'|'review'>>({});
let loadVersion=0;
function cards(item:Asset){return (item.content as Flash).cards;}
function micro(item:Asset){return item.content as Micro;}
function position(item:Asset){return positions.value[item.id]??0;}
function ratingKey(item:Asset){return item.id+':'+position(item);}
function countKnown(item:Asset){
 return cards(item).filter((_,i)=>ratings.value[item.id+':'+i]==='known').length;
}
function next(item:Asset,delta:number){
 positions.value[item.id]=Math.max(0,Math.min(cards(item).length-1,position(item)+delta));
 flips.value[item.id]=false;
}
function mark(item:Asset,rating:'known'|'review'){
 ratings.value[ratingKey(item)]=rating;
 flips.value[item.id]=false;
 if(position(item)<cards(item).length-1)next(item,1);
}
function reset(item:Asset){
 for(let i=0;i<cards(item).length;i++)delete ratings.value[item.id+':'+i];
 positions.value[item.id]=0;flips.value[item.id]=false;
}
async function load(){
 const workspace=props.workspaceId,n=++loadVersion;
 loading.value=true;error.value='';assets.value=[];
 try{
  const items=await apiJson<Asset[]>(workspacePath(workspace,'/learning-assets/student'));
  if(workspace!==props.workspaceId||n!==loadVersion)return;
  assets.value=items;
 }catch(e){
  if(workspace===props.workspaceId&&n===loadVersion)
   error.value=e instanceof Error?e.message:'No se pudieron abrir los recursos de repaso.';
 }finally{if(n===loadVersion)loading.value=false;}
}
watch(()=>props.workspaceId,()=>{
 ++loadVersion;positions.value={};flips.value={};ratings.value={};void load();
});
onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><Layers3 :size="22" class="text-brand"/><div>
   <h2 class="text-lg font-extrabold">Clase Viva · Repasa a tu ritmo</h2>
   <p class="mt-1 text-xs text-muted">Tarjetas y microlecciones revisadas y publicadas por tus profesores.</p>
  </div></div></template>
  <p v-if="loading" class="text-xs text-muted">Cargando el material de repaso…</p>
  <UiAlert v-else-if="error" tone="warning">{{error}}</UiAlert>
  <p v-else-if="!assets.length" class="text-sm text-muted">Tus docentes todavía no han publicado tarjetas o microlecciones.</p>
  <div v-else class="grid gap-5 lg:grid-cols-2">
   <article v-for="asset in assets" :key="asset.id" class="min-w-0 rounded-2xl border border-outline p-4">
    <div class="flex items-start justify-between gap-2">
     <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-brand">{{asset.kind==='FLASHCARDS'?'Tarjetas de estudio':'Microlección'}}</p>
      <h3 class="mt-2 text-base font-extrabold">{{asset.title}}</h3>
      <p class="mt-1 text-xs text-muted">{{asset.reflection.session.title}}</p>
     </div>
     <BookOpenCheck :size="20" class="shrink-0 text-brand"/>
    </div>
    <template v-if="asset.kind==='FLASHCARDS'">
     <div class="mt-4 flex items-center justify-between gap-2 text-xs text-muted">
      <span>Tarjeta {{position(asset)+1}} de {{cards(asset).length}}</span>
      <span>{{countKnown(asset)}} recordadas en esta sesión</span>
     </div>
     <button type="button" :aria-pressed="Boolean(flips[asset.id])"
      aria-label="Girar tarjeta para ver la respuesta"
      class="mt-3 flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-brand/30 bg-brand-soft p-5 text-center transition hover:border-brand"
      @click="flips[asset.id]=!flips[asset.id]">
      <p class="text-xs font-bold uppercase tracking-widest text-brand">{{flips[asset.id]?'Respuesta':'Pregunta'}}</p>
      <p class="mt-4 whitespace-pre-wrap text-lg font-extrabold text-ink">
       {{flips[asset.id]?cards(asset)[position(asset)]?.back:cards(asset)[position(asset)]?.front}}
      </p>
      <p class="mt-4 text-xs text-muted">Toca para {{flips[asset.id]?'ver la pregunta':'descubrir la respuesta'}}</p>
     </button>
     <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
      <UiButton variant="secondary" size="sm" :disabled="position(asset)===0" @click="next(asset,-1)">
       <ChevronLeft :size="14"/> Anterior
      </UiButton>
      <UiButton variant="secondary" size="sm" :disabled="position(asset)>=cards(asset).length-1" @click="next(asset,1)">
       Siguiente <ChevronRight :size="14"/>
      </UiButton>
     </div>
     <div class="mt-3 flex flex-wrap gap-2">
      <UiButton variant="secondary" size="sm" @click="mark(asset,'review')"><RotateCcw :size="14"/> Repasar</UiButton>
      <UiButton size="sm" @click="mark(asset,'known')"><CheckCircle2 :size="14"/> La recuerdo</UiButton>
      <button class="text-xs font-semibold text-muted underline" @click="reset(asset)">Reiniciar</button>
     </div>
     <p class="mt-3 text-xs text-muted">La autoevaluación es temporal y no modifica tus calificaciones ni competencias verificadas.</p>
    </template>
    <div v-else class="mt-4">
     <p class="whitespace-pre-wrap text-sm leading-6">{{micro(asset).summary}}</p>
     <div class="mt-4 space-y-3">
      <div v-for="(step,index) in micro(asset).steps" :key="index" class="rounded-xl bg-surface-muted p-4">
       <p class="text-xs font-extrabold text-brand">Paso {{index+1}} · {{step.heading}}</p>
       <p class="mt-2 whitespace-pre-wrap text-sm leading-6">{{step.body}}</p>
      </div>
     </div>
     <div v-if="micro(asset).reviewPrompt" class="mt-4 rounded-xl border border-outline p-4">
      <p class="text-xs font-bold text-brand">Para comprobar lo aprendido</p>
      <p class="mt-2 text-sm">{{micro(asset).reviewPrompt}}</p>
     </div>
    </div>
   </article>
  </div>
 </UiCard>
</template>
