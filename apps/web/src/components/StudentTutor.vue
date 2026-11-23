<script setup lang="ts">
import {ref,watch,onMounted,computed} from 'vue';
import {MessageCircleQuestion,BookOpenCheck,Send,ShieldCheck} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard,UiField,UiSelect,UiTextarea} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
import type {EvidenceBasedProfile} from '../shared/learner-profile';

type TutorAnswer={
 answer:string;referToTeacher:boolean;
 sources:Array<{id:string;title:string}>;
 disclaimer:string;model:string;
};
const props=defineProps<{workspaceId:string;courses:Array<{id:string;title:string}>}>();
const courseId=ref(''),question=ref(''),consent=ref(false),busy=ref(false);
const error=ref(''),answer=ref<TutorAnswer|null>(null);
type Referral={
 id:string;courseId:string;question:string;status:'OPEN'|'RESOLVED';reply:string|null;
 createdAt:string;resolvedAt:string|null;course:{title:string};
};
const referrals=ref<Referral[]>([]),sending=ref(false),loadingQuestions=ref(false),notice=ref('');
const courseReferrals=computed(()=>referrals.value.filter(item=>item.courseId===courseId.value));
const privateProfile=ref<EvidenceBasedProfile|null>(null);
const currentNextStep=computed(()=>privateProfile.value?.nextActions.find(item=>item.courseId===courseId.value)??null);
async function loadPrivateProfile(){
 const workspace=props.workspaceId;
 try{
  const data=await apiJson<EvidenceBasedProfile>(workspacePath(workspace,'/learning-progress/student/profile'));
  if(workspace===props.workspaceId)privateProfile.value=data;
 }catch{
  // Learning profile suggestions are optional and must not block a direct teacher message.
  if(workspace===props.workspaceId)privateProfile.value=null;
 }
}
let requestVersion=0;
async function refreshReferrals(){
 const workspace=props.workspaceId,n=++requestVersion;
 loadingQuestions.value=true;
 try{
  const data=await apiJson<Referral[]>(workspacePath(workspace,'/profe-sos/referrals/mine'));
  if(n===requestVersion&&workspace===props.workspaceId)referrals.value=data;
 }catch(e){
  if(n===requestVersion&&workspace===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudieron cargar las consultas al profesor.';
  }
 }finally{if(n===requestVersion)loadingQuestions.value=false;}
}
async function sendToTeacher(){
 if(sending.value||!courseId.value||question.value.trim().length<8)return;
 if(!window.confirm('¿Enviar esta pregunta a los profesores asignados al curso? Quedará guardada en tu academia y se podrá responder desde Profe SOS. No se enviará a un proveedor de IA.'))return;
 const workspace=props.workspaceId;
 sending.value=true;error.value='';notice.value='';
 try{
  await apiJson(workspacePath(workspace,'/profe-sos/referrals'),'POST',{
   courseId:courseId.value,question:question.value,
  });
  if(workspace!==props.workspaceId)return;
  notice.value='Tu pregunta se envió a los docentes del curso. Puedes consultar su respuesta aquí.';
  await refreshReferrals();
 }catch(e){
  if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No pudimos enviar tu pregunta.';
 }finally{sending.value=false;}
}

async function ask(){
 const workspace=props.workspaceId;
 busy.value=true;error.value='';answer.value=null;notice.value='';
 try{
  answer.value=await apiJson<TutorAnswer>(
   workspacePath(workspace,'/profe-sos/ask'),'POST',
   {courseId:courseId.value,question:question.value,approveExternalProcessing:consent.value},
  );
  if(workspace!==props.workspaceId)return;
  consent.value=false;
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No pudimos consultar a Profe SOS.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{
 ++requestVersion;courseId.value='';question.value='';answer.value=null;
 consent.value=false;notice.value='';error.value='';referrals.value=[];privateProfile.value=null;
 void loadPrivateProfile();
 void refreshReferrals();
});
onMounted(()=>{void refreshReferrals();void loadPrivateProfile();});
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><MessageCircleQuestion :size="22" class="text-brand"/><div>
   <h2 class="text-lg font-extrabold">Profe SOS</h2>
   <p class="mt-1 text-xs text-muted">Tu profesor define cómo te guía Profe SOS. La IA solo consulta notas aprobadas cuando el docente la habilita y tú autorizas cada pregunta.</p>
  </div></div></template>
  <div v-if="currentNextStep" class="mb-4 rounded-xl border border-outline bg-surface-muted p-4">
   <p class="text-xs font-bold text-brand">Siguiente paso de tu Pasaporte</p>
   <p class="mt-2 text-sm font-semibold">{{currentNextStep.title}}</p>
   <p class="mt-1 text-xs text-muted">
    {{currentNextStep.reason==='BELOW_TARGET'
     ?'Tu última valoración de la competencia está por debajo de la meta definida por el docente.'
     :currentNextStep.reason==='NO_EVIDENCE'
     ?'La competencia todavía no cuenta con una evaluación docente.'
     :'Puedes pedir una pista para avanzar en esta meta.'}}
   </p>
   <p class="mt-1 text-xs text-muted">Este recordatorio se calcula dentro de AcademyOS y no se envía al proveedor de IA.</p>
  </div>
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
   <UiButton type="button" variant="secondary" block :loading="sending" :disabled="!courseId||question.trim().length<8||sending" @click="sendToTeacher">
    <BookOpenCheck :size="15"/> Enviar directamente a mi profesor
   </UiButton>
   <p class="text-xs text-muted">Enviar a tu profesor no utiliza IA. Las preguntas quedan guardadas únicamente en esta academia y son visibles para sus docentes asignados y administradores.</p>
  </form>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-4">{{notice}}</UiAlert>
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
  <div class="mt-6 border-t border-outline pt-5">
   <div class="flex items-center gap-2 text-sm font-bold"><BookOpenCheck :size="18" class="text-brand"/> Mis consultas al profesor</div>
   <p v-if="loadingQuestions" class="mt-2 text-xs text-muted">Consultando preguntas…</p>
   <div v-else-if="courseReferrals.length" class="mt-3 space-y-3">
    <article v-for="item in courseReferrals" :key="item.id" class="rounded-xl border border-outline bg-surface-muted p-4">
     <p class="whitespace-pre-wrap text-sm">{{item.question}}</p>
     <p class="mt-2 text-xs text-muted">{{new Date(item.createdAt).toLocaleString('es-CO')}}</p>
     <div v-if="item.status==='RESOLVED'" class="mt-3 rounded-lg border border-outline bg-surface p-3">
      <p class="text-xs font-bold text-brand">Respuesta docente</p>
      <p class="mt-2 whitespace-pre-wrap text-sm">{{item.reply}}</p>
     </div>
     <p v-else class="mt-3 text-xs font-semibold text-muted">Pendiente de respuesta docente</p>
    </article>
   </div>
   <p v-else class="mt-2 text-xs text-muted">No has enviado dudas para este curso.</p>
  </div>
 </UiCard>
</template>