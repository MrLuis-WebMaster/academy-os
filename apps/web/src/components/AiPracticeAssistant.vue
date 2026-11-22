<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {Sparkles,ShieldCheck,RefreshCw,Save,Send} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard,UiField,UiInput,UiSelect} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Question={prompt:string;options:string[];correctIndex:number;explanation:string};
type Draft={
  id:string;title:string;questions:Question[];publishedAt:string|null;
  reflection:{sessionId:string;status:'DRAFT'|'REVIEW'|'PUBLISHED';session:{title:string}};
};
const props=defineProps<{workspaceId:string;sessions:Array<{id:string;title:string;courseId:string|null}>}>();
const sessionId=ref(''),consent=ref(false),busy=ref(false),loading=ref(false),message=ref(''),error=ref('');
const drafts=ref<Draft[]>([]);
const selectedId=ref('');
const title=ref(''),questions=ref<Question[]>([]);
const selected=computed(()=>drafts.value.find(d=>d.id===selectedId.value)??null);
function url(path:string){return workspacePath(props.workspaceId,path);}
async function refresh(){
 loading.value=true;
 try{
  drafts.value=await apiJson<Draft[]>(url('/practice/teacher'));
 }catch(e){error.value=e instanceof Error?e.message:'No pudimos cargar tus ejercicios.';}
 finally{loading.value=false;}
}
function choose(id:string){
 selectedId.value=id;error.value='';message.value='';
 const draft=drafts.value.find(d=>d.id===id);
 if(!draft)return;
 title.value=draft.title;
 questions.value=draft.questions.map(q=>({...q,options:[...q.options]}));
}
async function generate(){
 if(!sessionId.value||!consent.value)return;
 busy.value=true;error.value='';message.value='';
 try{
  const result=await apiJson<{id:string;reviewRequired:boolean;model:string}>(
    url('/class-alive/sessions/'+encodeURIComponent(sessionId.value)+'/suggest-practice'),
    'POST',{approveExternalProcessing:true},
  );
  consent.value=false;
  await refresh();choose(result.id);
  message.value='Borrador generado con '+result.model+'. Revisa cada pregunta y su respuesta correcta antes de publicar.';
 }catch(e){error.value=e instanceof Error?e.message:'No fue posible generar el borrador.';}
 finally{busy.value=false;}
}
async function save(){
 if(!selected.value||selected.value.publishedAt)return;
 busy.value=true;error.value='';message.value='';
 try{
  await apiJson(url('/practice/'+selected.value.id),'PATCH',{title:title.value,questions:questions.value});
  const id=selected.value.id;
  await refresh();choose(id);
  message.value='Borrador corregido y guardado; aún no está publicado.';
 }catch(e){error.value=e instanceof Error?e.message:'No pudimos guardar los cambios.';}
 finally{busy.value=false;}
}
async function publish(){
 if(!selected.value||selected.value.publishedAt)return;
 if(!window.confirm('¿Verificaste que las respuestas sean correctas y que no haya información personal de alumnos?'))return;
 busy.value=true;error.value='';message.value='';
 try{
  await save(); // Explicitly persist teacher revisions before publication.
  if(error.value)return;
  await apiJson(url('/practice/'+selected.value.id+'/publish'),'POST');
  const id=selected.value.id;
  await refresh();choose(id);
  message.value='Actividad publicada. Los alumnos inscritos ya pueden resolverla.';
 }catch(e){error.value=e instanceof Error?e.message:'No pudimos publicar la práctica.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{selectedId.value='';refresh();});
onMounted(refresh);
</script>
<template>
 <UiCard class="mt-6">
  <template #header>
   <div class="flex items-center gap-3"><Sparkles :size="22" class="text-brand"/><div>
    <h2 class="text-lg font-extrabold">Clase Viva con IA</h2>
    <p class="mt-1 text-xs text-muted">Genera borradores desde tus notas; tú decides qué revisar, corregir y publicar.</p>
   </div></div>
  </template>
  <UiAlert tone="warning">
   No incluyas nombres, datos de contacto ni información sensible de estudiantes. Al generar, las notas de clase serán enviadas al proveedor de IA configurado. No se procesa nada automáticamente.
  </UiAlert>
  <form class="mt-5 grid gap-3 sm:grid-cols-2" @submit.prevent="generate">
   <div class="sm:col-span-2"><UiField for="ai-session" label="Clase con observaciones guardadas" required>
    <UiSelect id="ai-session" v-model="sessionId" required>
      <option value="">Selecciona una sesión</option>
      <option v-for="session in sessions.filter(s=>s.courseId)" :key="session.id" :value="session.id">{{session.title}}</option>
    </UiSelect>
   </UiField></div>
   <label class="flex items-start gap-3 sm:col-span-2">
    <input v-model="consent" type="checkbox" class="mt-1 size-4 accent-violet-600" />
    <span class="text-xs leading-5 text-muted">Confirmo que revisé las notas para eliminar datos personales y autorizo esta generación concreta con un servicio externo de IA.</span>
   </label>
   <div class="sm:col-span-2"><UiButton type="submit" :loading="busy" :disabled="!sessionId||!consent" block><Sparkles :size="16"/> Sugerir una práctica</UiButton></div>
  </form>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="message" tone="success" class="mt-4">{{message}}</UiAlert>
  <div class="mt-6 border-t border-outline pt-5">
   <div class="flex flex-wrap items-center justify-between gap-3">
    <p class="text-sm font-bold">Revisión del profesor</p>
    <UiButton variant="ghost" size="sm" @click="refresh"><RefreshCw :size="14"/> Actualizar</UiButton>
   </div>
   <p v-if="loading" class="mt-3 text-xs text-muted">Cargando actividades...</p>
   <UiField v-else for="ai-draft-select" label="Elige una actividad para revisar">
    <UiSelect id="ai-draft-select" :model-value="selectedId" @update:model-value="choose(String($event))">
     <option value="">Seleccionar borrador</option>
     <option v-for="draft in drafts" :key="draft.id" :value="draft.id">{{ draft.title }} — {{ draft.publishedAt?'Publicado':'Borrador' }}</option>
    </UiSelect>
   </UiField>
   <form v-if="selected" class="mt-5 space-y-4" @submit.prevent="save">
    <UiField for="ai-draft-title" label="Título de la actividad">
     <UiInput id="ai-draft-title" v-model="title" :disabled="Boolean(selected.publishedAt)" :minlength="3" :maxlength="120" required/>
    </UiField>
    <div v-for="(question,qIndex) in questions" :key="qIndex" class="rounded-xl border border-outline bg-surface-muted p-4">
     <p class="mb-3 text-sm font-bold">Pregunta {{qIndex+1}}</p>
     <UiField :for="'ai-question-'+qIndex" label="Enunciado" required>
      <UiInput :id="'ai-question-'+qIndex" v-model="question.prompt" :disabled="Boolean(selected.publishedAt)" required :minlength="8" :maxlength="500"/>
     </UiField>
     <div class="mt-3 grid gap-3 sm:grid-cols-2">
      <UiField v-for="(option,i) in question.options" :key="i" :for="'ai-option-'+qIndex+'-'+i" :label="'Opción '+(i+1)" required>
       <UiInput :id="'ai-option-'+qIndex+'-'+i" v-model="question.options[i]" :disabled="Boolean(selected.publishedAt)" required :maxlength="180"/>
      </UiField>
     </div>
     <div class="mt-3 grid gap-3 sm:grid-cols-2">
      <UiField :for="'ai-correct-'+qIndex" label="Respuesta correcta">
       <UiSelect :id="'ai-correct-'+qIndex" :model-value="question.correctIndex" :disabled="Boolean(selected.publishedAt)" @update:model-value="question.correctIndex=Number($event)">
        <option v-for="(_,i) in question.options" :key="i" :value="i">Opción {{i+1}}</option>
       </UiSelect>
      </UiField>
      <UiField :for="'ai-explanation-'+qIndex" label="Explicación">
       <UiInput :id="'ai-explanation-'+qIndex" v-model="question.explanation" :disabled="Boolean(selected.publishedAt)" :maxlength="500"/>
      </UiField>
     </div>
    </div>
    <UiAlert v-if="selected.reflection.status!=='PUBLISHED'" tone="warning">Primero publica las notas de esta clase en Clase Viva. Los ejercicios no se publicarán mientras las notas estén en borrador.</UiAlert>
    <div v-if="!selected.publishedAt" class="flex flex-wrap gap-3">
     <UiButton type="submit" :loading="busy"><Save :size="15"/> Guardar correcciones</UiButton>
     <UiButton type="button" variant="secondary" :disabled="busy||selected.reflection.status!=='PUBLISHED'" @click="publish"><Send :size="15"/> Aprobar y publicar</UiButton>
    </div>
    <p v-else class="text-xs font-bold text-success">Actividad aprobada y publicada.</p>
   </form>
  </div>
 </UiCard>
</template>