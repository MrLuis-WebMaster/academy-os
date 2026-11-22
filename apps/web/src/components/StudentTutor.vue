<script setup lang="ts">
import {ref,watch} from 'vue';
import {MessageCircleQuestion,BookOpenCheck,Send,ShieldCheck} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard,UiField,UiSelect,UiTextarea} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type TutorAnswer={
 answer:string;referToTeacher:boolean;
 sources:Array<{id:string;title:string}>;
 disclaimer:string;model:string;
};
const props=defineProps<{workspaceId:string;courses:Array<{id:string;title:string}>}>();
const courseId=ref(''),question=ref(''),consent=ref(false),busy=ref(false);
const error=ref(''),answer=ref<TutorAnswer|null>(null);
async function ask(){
 busy.value=true;error.value='';answer.value=null;
 try{
  answer.value=await apiJson<TutorAnswer>(
   workspacePath(props.workspaceId,'/profe-sos/ask'),'POST',
   {courseId:courseId.value,question:question.value,approveExternalProcessing:consent.value},
  );
  consent.value=false;
 }catch(e){error.value=e instanceof Error?e.message:'No pudimos consultar a Profe SOS.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{courseId.value='';question.value='';answer.value=null;consent.value=false;});
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><MessageCircleQuestion :size="22" class="text-brand"/><div>
   <h2 class="text-lg font-extrabold">Profe SOS</h2>
   <p class="mt-1 text-xs text-muted">Pregunta sobre tus cursos. Solo consultará notas que tu profesor haya aprobado y publicado.</p>
  </div></div></template>
  <form class="space-y-4" @submit.prevent="ask">
   <UiField for="sos-course" label="¿Sobre qué curso necesitas ayuda?" required>
    <UiSelect id="sos-course" v-model="courseId" required>
     <option value="">Elige un curso</option>
     <option v-for="course in courses" :key="course.id" :value="course.id">{{course.title}}</option>
    </UiSelect>
   </UiField>
   <UiField for="sos-question" label="Tu pregunta" required hint="Escribe tu duda sin compartir datos personales.">
    <UiTextarea id="sos-question" v-model="question" :rows="3" :minlength="8" :maxlength="650" required placeholder="Ej. ¿Puedes explicarme de otra forma cómo despejar una ecuación?"/>
   </UiField>
   <label class="flex items-start gap-3">
    <input v-model="consent" type="checkbox" class="mt-1 size-4 accent-violet-600"/>
    <span class="text-xs leading-5 text-muted">Autorizo enviar esta pregunta y las notas aprobadas del curso al proveedor de IA. No se envían notas privadas ni materiales no publicados.</span>
   </label>
   <UiButton type="submit" block :loading="busy" :disabled="!courseId||!consent||question.trim().length<8"><Send :size="15"/> Preguntar a Profe SOS</UiButton>
  </form>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <div v-if="answer" class="mt-6 space-y-4 border-t border-outline pt-5">
   <div class="flex items-center gap-2 text-sm font-extrabold text-brand"><MessageCircleQuestion :size="19"/> Respuesta orientativa</div>
   <p class="whitespace-pre-wrap text-sm leading-7 text-ink">{{answer.answer}}</p>
   <div v-if="answer.sources.length" class="rounded-xl bg-surface-muted p-4">
    <p class="flex items-center gap-2 text-xs font-bold text-muted"><BookOpenCheck :size="16"/> Clases consultadas</p>
    <div class="mt-2 space-y-1"><p v-for="source in answer.sources" :key="source.id" class="text-xs text-ink">{{source.title}}</p></div>
   </div>
   <UiAlert v-if="answer.referToTeacher" tone="warning">La información disponible puede no ser suficiente. Confirma tu pregunta con tu profesor.</UiAlert>
   <p class="text-xs leading-5 text-muted">{{answer.disclaimer}}</p>
  </div>
 </UiCard>
</template>