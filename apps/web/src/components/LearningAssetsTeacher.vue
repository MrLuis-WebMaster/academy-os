<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {BookOpenCheck,BrainCircuit,Plus,RefreshCw,Save,Send,Trash2} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Kind='FLASHCARDS'|'MICROLESSON';
type Card={front:string;back:string};
type Step={heading:string;body:string};
type Flash={cards:Card[]};
type Micro={summary:string;steps:Step[];reviewPrompt?:string};
type Asset={
 id:string;kind:Kind;title:string;content:Flash|Micro;publishedAt:string|null;
 reflection:{sessionId:string;status:'DRAFT'|'REVIEW'|'PUBLISHED';
 session:{title:string;courseId:string|null}};
};
const props=defineProps<{workspaceId:string;sessions:Array<{id:string;title:string;courseId:string|null}>}>();
const assets=ref<Asset[]>([]),selectedId=ref(''),sessionId=ref('');
const kind=ref<Kind>('FLASHCARDS'),title=ref('');
const cards=ref<Card[]>([{front:'',back:''},{front:'',back:''}]);
const summary=ref(''),steps=ref<Step[]>([{heading:'',body:''}]),reviewPrompt=ref('');
const busy=ref(false),loading=ref(true),error=ref(''),notice=ref('');
let loadVersion=0;
const selected=computed(()=>assets.value.find(asset=>asset.id===selectedId.value)??null);
function route(workspace:string,path:string){return workspacePath(workspace,'/learning-assets'+path);}
function resetDraft(){
 selectedId.value='';sessionId.value='';
 kind.value='FLASHCARDS';title.value='';
 cards.value=[{front:'',back:''},{front:'',back:''}];
 summary.value='';steps.value=[{heading:'',body:''}];reviewPrompt.value='';
}
function choose(id:string){
 error.value='';notice.value='';selectedId.value=id;
 const asset=assets.value.find(row=>row.id===id);
 if(!asset){resetDraft();return;}
 sessionId.value=asset.reflection.sessionId;
 kind.value=asset.kind;title.value=asset.title;
 if(asset.kind==='FLASHCARDS'){
  cards.value=(asset.content as Flash).cards.map(card=>({...card}));
 }else{
  const content=asset.content as Micro;
  summary.value=content.summary;reviewPrompt.value=content.reviewPrompt??'';
  steps.value=content.steps.map(step=>({...step}));
 }
}
function payload(){
 const content=kind.value==='FLASHCARDS'
  ?{cards:cards.value.map(card=>({...card}))}
  :{summary:summary.value,steps:steps.value.map(step=>({...step})),
    ...(reviewPrompt.value.trim()?{reviewPrompt:reviewPrompt.value}:{}),
   };
 return {title:title.value,content};
}
async function refresh(){
 const workspace=props.workspaceId,n=++loadVersion;
 loading.value=true;error.value='';
 try{
  const result=await apiJson<Asset[]>(route(workspace,'/staff'));
  if(workspace!==props.workspaceId||n!==loadVersion)return;
  assets.value=result;
  if(selectedId.value){
   if(assets.value.some(a=>a.id===selectedId.value))choose(selectedId.value);
   else resetDraft();
  }
 }catch(e){
  if(workspace===props.workspaceId&&n===loadVersion){
   error.value=e instanceof Error?e.message:'No se pudieron cargar los recursos.';
  }
 }finally{if(n===loadVersion)loading.value=false;}
}
async function save(){
 if(busy.value||!title.value.trim()||!sessionId.value)return;
 const workspace=props.workspaceId,id=selectedId.value;
 busy.value=true;error.value='';notice.value='';
 try{
  const data=id?await apiJson<Asset>(route(workspace,'/'+encodeURIComponent(id)),'PATCH',payload())
   :await apiJson<Asset>(route(workspace,''),'POST',{
     sessionId:sessionId.value,kind:kind.value,...payload(),
   });
  if(workspace!==props.workspaceId)return;
  await refresh();choose(data.id);
  notice.value='Recurso guardado como borrador. Los alumnos todavía no pueden verlo.';
 }catch(e){
  if(workspace===props.workspaceId)
   error.value=e instanceof Error?e.message:'No se pudo guardar el recurso.';
 }finally{busy.value=false;}
}
async function publish(){
 if(!selected.value||selected.value.publishedAt||busy.value)return;
 if(selected.value.reflection.status!=='PUBLISHED'){
  error.value='Publica primero las notas de Clase Viva.';
  return;
 }
 if(!window.confirm('¿Revisaste todo el contenido y comprobaste que no incluye datos personales de alumnos?')){
  return;
 }
 const workspace=props.workspaceId,id=selected.value.id;
 busy.value=true;error.value='';notice.value='';
 try{
  await apiJson(route(workspace,'/'+encodeURIComponent(id)),'PATCH',payload());
  await apiJson(route(workspace,'/'+encodeURIComponent(id)+'/publish'),'POST');
  if(workspace!==props.workspaceId)return;
  await refresh();choose(id);
  notice.value='Recurso publicado. Ya está disponible para los alumnos matriculados.';
 }catch(e){
  if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo publicar el recurso.';
 }finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{++loadVersion;resetDraft();assets.value=[];notice.value='';void refresh();});
onMounted(()=>void refresh());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><BrainCircuit :size="22" class="text-brand"/><div>
   <h2 class="text-lg font-extrabold">Clase Viva · Material de repaso</h2>
   <p class="mt-1 text-xs text-muted">Crea tarjetas de estudio y microlecciones asociadas a una clase. Tú revisas y publicas.</p>
  </div></div></template>
  <UiAlert tone="warning">Solo los recursos aprobados y asociados a notas publicadas aparecen en el Aula Digital. Las tarjetas no modifican automáticamente las competencias del Pasaporte.</UiAlert>
  <p v-if="loading" class="mt-3 text-xs text-muted">Consultando recursos…</p>
  <div class="mt-4 space-y-4">
   <label class="block text-xs font-semibold">Revisar borrador o crear uno nuevo
    <select :value="selectedId" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"
     @change="choose(($event.target as HTMLSelectElement).value)">
     <option value="">Crear recurso nuevo</option>
     <option v-for="a in assets" :key="a.id" :value="a.id">{{a.title}} · {{a.kind==='FLASHCARDS'?'Tarjetas':'Microlección'}} · {{a.publishedAt?'Publicado':'Borrador'}}</option>
    </select>
   </label>
   <form class="space-y-4" @submit.prevent="save">
    <div class="grid gap-3 md:grid-cols-2">
     <label class="text-xs font-semibold">Clase vinculada
      <select v-model="sessionId" required :disabled="Boolean(selected)" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
       <option value="">Selecciona una clase</option>
       <option v-for="session in sessions.filter(s=>s.courseId)" :key="session.id" :value="session.id">{{session.title}}</option>
      </select>
     </label>
     <label class="text-xs font-semibold">Formato
      <select v-model="kind" :disabled="Boolean(selected)" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
       <option value="FLASHCARDS">Tarjetas de estudio</option>
       <option value="MICROLESSON">Microlección guiada</option>
      </select>
     </label>
    </div>
    <label class="block text-xs font-semibold">Título
     <input v-model="title" required minlength="3" maxlength="140" :disabled="Boolean(selected?.publishedAt)"
      placeholder="Ej. Pasado simple: guía de repaso" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/>
    </label>
    <template v-if="kind==='FLASHCARDS'">
     <p class="text-xs text-muted">De 2 a 30 tarjetas con una pregunta y una respuesta. No incluyas datos personales.</p>
     <article v-for="(card,i) in cards" :key="i" class="rounded-xl border border-outline bg-surface-muted p-4">
      <div class="flex items-center justify-between gap-2">
       <p class="text-xs font-bold">Tarjeta {{i+1}}</p>
       <button type="button" aria-label="Quitar tarjeta" :disabled="cards.length<=2||Boolean(selected?.publishedAt)"
        class="text-muted disabled:opacity-30" @click="cards.splice(i,1)"><Trash2 :size="15"/></button>
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
       <label class="text-xs font-semibold">Frente
        <textarea v-model="card.front" required minlength="3" maxlength="250" rows="2" :disabled="Boolean(selected?.publishedAt)"
         class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea>
       </label>
       <label class="text-xs font-semibold">Respuesta
        <textarea v-model="card.back" required minlength="3" maxlength="700" rows="2" :disabled="Boolean(selected?.publishedAt)"
         class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea>
       </label>
      </div>
     </article>
     <UiButton v-if="cards.length<30&&!selected?.publishedAt" type="button" variant="secondary" size="sm"
      @click="cards.push({front:'',back:''})"><Plus :size="14"/> Añadir tarjeta</UiButton>
    </template>
    <template v-else>
     <label class="block text-xs font-semibold">Explicación breve (mín. 30 caracteres)
      <textarea v-model="summary" required minlength="30" maxlength="2000" rows="4" :disabled="Boolean(selected?.publishedAt)"
       class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea>
     </label>
     <article v-for="(step,i) in steps" :key="i" class="rounded-xl border border-outline bg-surface-muted p-4">
      <div class="flex items-center justify-between gap-2"><p class="text-xs font-bold">Paso {{i+1}}</p>
       <button type="button" aria-label="Quitar paso" :disabled="steps.length<=1||Boolean(selected?.publishedAt)"
        @click="steps.splice(i,1)"><Trash2 :size="15"/></button></div>
      <label class="mt-3 block text-xs font-semibold">Título
       <input v-model="step.heading" minlength="3" maxlength="120" required :disabled="Boolean(selected?.publishedAt)"
        class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
      <label class="mt-3 block text-xs font-semibold">Desarrollo
       <textarea v-model="step.body" minlength="15" maxlength="1500" required rows="3" :disabled="Boolean(selected?.publishedAt)"
        class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea></label>
     </article>
     <UiButton v-if="steps.length<8&&!selected?.publishedAt" type="button" size="sm" variant="secondary"
      @click="steps.push({heading:'',body:''})"><Plus :size="14"/> Añadir paso</UiButton>
     <label class="block text-xs font-semibold">Pregunta de reflexión (opcional)
      <textarea v-model="reviewPrompt" minlength="8" maxlength="400" rows="2" :disabled="Boolean(selected?.publishedAt)"
       class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea>
     </label>
    </template>
    <div v-if="!selected?.publishedAt" class="flex flex-wrap gap-3">
     <UiButton type="submit" :loading="busy" :disabled="busy||!sessionId"><Save :size="15"/> Guardar borrador</UiButton>
     <UiButton v-if="selected" type="button" variant="secondary" :disabled="busy||selected.reflection.status!=='PUBLISHED'" @click="publish">
      <Send :size="15"/> Aprobar y publicar
     </UiButton>
    </div>
    <p v-else class="flex items-center gap-2 text-xs font-semibold text-success"><BookOpenCheck :size="15"/> Material publicado.</p>
    <p v-if="selected&&selected.reflection.status!=='PUBLISHED'" class="text-xs text-muted">Primero publica las notas de la clase vinculada para habilitar la publicación.</p>
   </form>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-4">{{notice}}</UiAlert>
 </UiCard>
</template>
