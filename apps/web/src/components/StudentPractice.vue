<script setup lang="ts">
import {apiJson,workspacePath} from '../shared/api-client';
import type {EvidenceBasedProfile} from '../shared/learner-profile';
import {onMounted,ref,watch} from 'vue';
import {CheckCircle2,ClipboardCheck,RotateCcw,Target,TrendingUp} from 'lucide-vue-next';

const props=defineProps<{workspaceId:string}>();
type PublicQuestion={prompt:string;options:string[]};
type Practice={
  id:string;title:string;sessionTitle:string;courseId:string|null;
  questions:PublicQuestion[];lastAttempt:{id:string;score:number|null;createdAt:string}|null;
};
type Passport={courseId:string;title:string;subject:string;attempts:number;averageScore:number|null;metric:string};
type Skill={
  topicId:string;mastery:number;evidenceCount:number;
  topic:{title:string;courseId:string;course:{title:string}};
};
type Goal={
  id:string;courseId:string;topicId:string|null;studentUserId:string;
  title:string;description:string|null;targetMastery:number|null;targetAt:string|null;
  status:'ACTIVE'|'ACHIEVED'|'CANCELLED';createdAt:string;completedAt:string|null;
  course:{title:string};topic:{title:string}|null;
};
type StudentProgress={skills:Skill[];goals:Goal[]};
type AttemptResult={
  score:number;correct:number;total:number;attemptNumber:number;
  feedback:Array<{correct:boolean;correctIndex:number;explanation:string}>;
};
const loading=ref(true),busy=ref(''),error=ref(''),notice=ref('');
const practices=ref<Practice[]>([]),passport=ref<Passport[]>([]);
const verifiedSkills=ref<Skill[]>([]),goals=ref<Goal[]>([]);
const profile=ref<EvidenceBasedProfile|null>(null);
const selected=ref<Record<string,Record<number,number>>>({});
const results=ref<Record<string,AttemptResult>>({});
const optionLetters=['A','B','C','D'];
let loadVersion=0;
function requestFor<T>(workspaceId:string,path:string,method='GET',body?:unknown):Promise<T>{
  return apiJson<T>(workspacePath(workspaceId,path),method,body);
}
async function load(){
  const workspaceId=props.workspaceId,version=++loadVersion;
  loading.value=true;error.value='';
  practices.value=[];passport.value=[];verifiedSkills.value=[];goals.value=[];profile.value=null;
  const rows=await Promise.allSettled([
    requestFor<Practice[]>(workspaceId,'/practice/student'),
    requestFor<Passport[]>(workspaceId,'/practice/passport'),
    requestFor<StudentProgress>(workspaceId,'/learning-progress/student'),
    requestFor<EvidenceBasedProfile>(workspaceId,'/learning-progress/student/profile'),
  ]);
  if(version!==loadVersion||workspaceId!==props.workspaceId)return;
  if(rows.some(row=>row.status==='rejected')){
    error.value='No se pudieron cargar todas las actividades y metas de aprendizaje. Revisa tu conexión.';
  }
  if(rows[0]?.status==='fulfilled')practices.value=rows[0].value;
  if(rows[1]?.status==='fulfilled')passport.value=rows[1].value;
  if(rows[2]?.status==='fulfilled'){
    verifiedSkills.value=rows[2].value.skills;
    goals.value=rows[2].value.goals;
  }
  if(rows[3]?.status==='fulfilled')profile.value=rows[3].value;
  loading.value=false;
}
function choose(activityId:string,questionIndex:number,optionIndex:number){
  selected.value={
    ...selected.value,
    [activityId]:{...(selected.value[activityId]??{}),[questionIndex]:optionIndex},
  };
}
async function submit(activity:Practice){
  if(busy.value)return;
  const workspaceId=props.workspaceId;
  const answers=activity.questions.map((_,i)=>selected.value[activity.id]?.[i]);
  if(answers.some(a=>a===undefined)){
    error.value='Responde todas las preguntas antes de enviar.';
    return;
  }
  busy.value=activity.id;error.value='';notice.value='';
  try{
    const result=await requestFor<AttemptResult>(
      workspaceId,'/practice/'+encodeURIComponent(activity.id)+'/attempts',
      'POST',{answers},
    );
    if(workspaceId!==props.workspaceId)return;
    results.value={...results.value,[activity.id]:result};
    const [newPassport,newPractices]=await Promise.all([
      requestFor<Passport[]>(workspaceId,'/practice/passport'),
      requestFor<Practice[]>(workspaceId,'/practice/student'),
    ]);
    if(workspaceId!==props.workspaceId)return;
    passport.value=newPassport;
    practices.value=newPractices;
    notice.value='Práctica entregada y corregida.';
  }catch(e){
    if(workspaceId===props.workspaceId){
      error.value=e instanceof Error?e.message:'No se pudo entregar la práctica.';
    }
  }finally{busy.value='';}
}
watch(()=>props.workspaceId,()=>{
  ++loadVersion;
  selected.value={};results.value={};notice.value='';busy.value='';error.value='';
  void load();
});
onMounted(()=>void load());
</script>
<template>
<section class="space-y-5">
  <div class="flex items-center gap-3"><TrendingUp :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Mi Pasaporte</h2><p class="mt-1 text-xs text-muted">Resultados basados únicamente en ejercicios que has completado.</p></div></div>
  <section v-if="!loading&&profile" class="space-y-3">
   <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-xl border border-outline bg-surface p-4">
     <p class="text-xs text-muted">Competencias verificadas</p>
     <p class="mt-2 text-xl font-extrabold">{{profile.verifiedCompetencies}}</p>
    </div>
    <div class="rounded-xl border border-outline bg-surface p-4">
     <p class="text-xs text-muted">Evidencias docentes</p>
     <p class="mt-2 text-xl font-extrabold">{{profile.humanEvidenceCount}}</p>
    </div>
    <div class="rounded-xl border border-outline bg-surface p-4">
     <p class="text-xs text-muted">Metas activas</p>
     <p class="mt-2 text-xl font-extrabold">{{profile.activeGoals}}</p>
    </div>
    <div class="rounded-xl border border-outline bg-surface p-4">
     <p class="text-xs text-muted">Metas alcanzadas</p>
     <p class="mt-2 text-xl font-extrabold">{{profile.achievedGoals}}</p>
    </div>
   </div>
   <div v-if="profile.nextActions.length" class="rounded-xl border border-outline bg-surface p-4">
    <h3 class="flex items-center gap-2 text-sm font-bold"><Target :size="17" class="text-brand"/> Mis próximos objetivos</h3>
    <div v-for="next in profile.nextActions" :key="next.goalId" class="mt-3 border-t border-outline pt-3">
     <p class="text-xs font-bold text-brand">{{next.courseTitle}}</p>
     <p class="mt-1 text-sm font-semibold">{{next.title}}</p>
     <p class="mt-1 text-xs text-muted">
      {{next.reason==='BELOW_TARGET'
       ?'Valoración docente: '+next.verifiedMastery+'% frente a una meta de '+next.targetMastery+'%.'
       :next.reason==='NO_EVIDENCE'
       ?'Aún no hay evidencias evaluadas de esta competencia.'
       :'Meta definida por tu docente, pendiente de revisión.'}}
     </p>
    </div>
   </div>
   <p v-else class="text-xs text-muted">Cuando tu docente asigne metas, aquí verás los próximos objetivos basados en tus evaluaciones.</p>
   <div v-if="profile.milestones.length" class="rounded-xl border border-outline bg-surface p-4">
    <h3 class="text-sm font-bold">Logros confirmados por docentes</h3>
    <p v-for="milestone in profile.milestones" :key="milestone.goalId" class="mt-2 text-xs">
     <CheckCircle2 :size="14" class="mr-1 inline text-success"/>{{milestone.title}} · {{milestone.courseTitle}}
    </p>
   </div>
   <p class="text-xs text-muted">{{profile.disclaimer}}</p>
  </section>
  <p v-if="loading" class="rounded-xl bg-surface-muted p-5 text-xs text-muted">Preparando tus prácticas...</p>
  <p v-if="error" role="alert" class="rounded-xl bg-danger-soft p-4 text-sm text-danger">{{ error }}</p>
  <p v-if="notice" role="status" class="rounded-xl bg-success-soft p-4 text-sm text-success">{{ notice }}</p>
  <div v-if="!loading && passport.length" class="grid gap-3 sm:grid-cols-2">
    <article v-for="course in passport" :key="course.courseId" class="rounded-2xl border border-outline bg-surface p-5">
      <p class="text-xs font-bold text-brand">{{ course.subject }}</p>
      <h3 class="mt-2 text-base font-extrabold">{{ course.title }}</h3>
      <p class="mt-3 text-3xl font-extrabold">{{ course.averageScore===null?'—':course.averageScore+'%' }}</p>
      <p class="mt-1 text-xs text-muted">{{ course.metric }}</p>
      <p class="mt-3 text-xs text-muted">{{ course.attempts }} {{ course.attempts===1?'intento registrado':'intentos registrados' }}</p>
      <div class="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"><div class="h-full rounded-full bg-brand-soft0" :style="{width:(course.averageScore??0)+'%'}"></div></div>
    </article>
  </div>
  <section v-if="!loading && (verifiedSkills.length || goals.length)" class="space-y-3">
    <div class="flex items-center gap-2"><Target :size="19" class="text-brand"/><h3 class="text-base font-extrabold">Mis competencias y metas</h3></div>
    <p class="text-xs text-muted">Estos resultados son valoraciones registradas por tus docentes y no calificaciones inferidas automáticamente.</p>
    <div v-if="verifiedSkills.length" class="grid gap-3 sm:grid-cols-2">
      <article v-for="skill in verifiedSkills" :key="skill.topicId" class="rounded-xl border border-outline bg-surface p-4">
        <p class="text-xs font-bold text-brand">{{skill.topic.course.title}}</p>
        <h4 class="mt-1 text-sm font-bold">{{skill.topic.title}}</h4>
        <p class="mt-2 text-2xl font-extrabold">{{skill.mastery}}%</p>
        <p class="mt-1 text-xs text-muted">{{skill.evidenceCount}} {{skill.evidenceCount===1?'valoración docente':'valoraciones docentes'}}</p>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"><div class="h-full rounded-full bg-brand" :style="{width:skill.mastery+'%'}"></div></div>
      </article>
    </div>
    <div v-if="goals.length" class="grid gap-3 sm:grid-cols-2">
      <article v-for="goal in goals" :key="goal.id" class="rounded-xl border border-outline bg-surface p-4">
        <p class="text-xs font-bold text-brand">{{goal.course.title}}</p>
        <h4 class="mt-1 text-sm font-bold">{{goal.title}}</h4>
        <p v-if="goal.description" class="mt-2 text-xs text-muted">{{goal.description}}</p>
        <p class="mt-2 text-xs font-semibold">{{goal.status==='ACTIVE'?'En progreso':goal.status==='ACHIEVED'?'Meta alcanzada':'Meta cancelada'}}</p>
        <p v-if="goal.targetMastery" class="mt-1 text-xs text-muted">Objetivo: {{goal.targetMastery}}%</p>
        <p v-if="goal.targetAt" class="mt-1 text-xs text-muted">Fecha objetivo: {{new Date(goal.targetAt).toLocaleDateString('es-CO')}}</p>
      </article>
    </div>
  </section>
  <div class="flex items-center gap-3 pt-3"><ClipboardCheck :size="21" class="text-brand"/><div><h2 class="text-lg font-extrabold">Prácticas de Clase Viva</h2><p class="mt-1 text-xs text-muted">Retos publicados por tus profesores, corregidos al entregar.</p></div></div>
  <p v-if="!loading && !practices.length" class="rounded-2xl border border-outline bg-surface p-5 text-sm text-muted">Todavía no hay ejercicios publicados. Cuando tu profesor prepare uno, aparecerá aquí.</p>
  <article v-for="practice in practices" :key="practice.id" class="rounded-2xl border border-outline bg-surface p-5 sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-2"><div><p class="text-xs font-bold text-brand">{{ practice.sessionTitle }}</p><h3 class="mt-2 text-base font-extrabold">{{ practice.title }}</h3></div><span v-if="practice.lastAttempt" class="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">Último intento: {{ practice.lastAttempt.score }}%</span></div>
    <div v-for="(question,questionIndex) in practice.questions" :key="questionIndex" class="mt-5 border-t border-outline pt-4">
      <p class="text-sm font-bold">{{ questionIndex+1 }}. {{ question.prompt }}</p>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <button v-for="(option,optionIndex) in question.options" :key="optionIndex"
          :aria-pressed="selected[practice.id]?.[questionIndex]===optionIndex"
          :disabled="Boolean(results[practice.id]) || busy===practice.id"
          class="flex items-start gap-2 rounded-xl border p-3 text-left text-xs disabled:cursor-default"
          :class="selected[practice.id]?.[questionIndex]===optionIndex?'border-brand bg-brand-soft':'border-outline bg-surface'"
          @click="choose(practice.id,questionIndex,optionIndex)">
          <span class="font-extrabold text-brand">{{ optionLetters[optionIndex] }}.</span><span>{{ option }}</span>
        </button>
      </div>
      <p v-if="results[practice.id]?.feedback[questionIndex]" class="mt-3 text-xs" :class="results[practice.id].feedback[questionIndex].correct?'text-success':'text-warning'">
        {{ results[practice.id].feedback[questionIndex].correct?'¡Correcto!':'La respuesta correcta era '+optionLetters[results[practice.id].feedback[questionIndex].correctIndex]+'.' }}
        {{ results[practice.id].feedback[questionIndex].explanation }}
      </p>
    </div>
    <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p v-if="results[practice.id]" class="flex items-center gap-2 text-sm font-extrabold text-success"><CheckCircle2 :size="17"/> {{ results[practice.id].correct }}/{{ results[practice.id].total }} · {{ results[practice.id].score }}%</p>
      <p v-else class="text-xs text-muted">Hasta 3 intentos por práctica.</p>
      <button v-if="results[practice.id]" class="flex items-center gap-2 rounded-xl border border-outline px-4 py-3 text-xs font-bold" @click="selected[practice.id]={}; delete results[practice.id]"><RotateCcw :size="14"/> Intentar otra vez</button>
      <button v-else :disabled="busy===practice.id || Object.keys(selected[practice.id]??{}).length!==practice.questions.length" class="rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white disabled:opacity-40" @click="submit(practice)">{{ busy===practice.id?'Corrigiendo...':'Entregar práctica' }}</button>
    </div>
  </article>
</section>
</template>