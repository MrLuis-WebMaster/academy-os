<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {BookOpenCheck,Target,TrendingUp} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Goal={
 id:string;courseId:string;topicId:string|null;studentUserId:string;
 title:string;description:string|null;targetMastery:number|null;targetAt:string|null;
 status:'ACTIVE'|'ACHIEVED'|'CANCELLED';createdAt:string;completedAt:string|null;
};
type Topic={id:string;title:string;order:number};
type Student={
 id:string;name:string;
 skills:Array<{topicId:string;mastery:number;evidenceCount:number}>;
 goals:Goal[];
};
type CourseProgress={courseId:string;topics:Topic[];students:Student[]};
type Insight={
 topicId:string;topicTitle:string;belowTargetCount:number;awaitingEvidenceCount:number;
 studentCount:number;action:'PREPARE_REINFORCEMENT'|'COLLECT_EVIDENCE';
};
type Insights={courseId:string;insights:Insight[];disclaimer:string};

const props=defineProps<{
 workspaceId:string;courses:Array<{id:string;title:string}>;
}>();
const courseId=ref(''),course=ref<CourseProgress|null>(null),loading=ref(false);
const insights=ref<Insights|null>(null);
const studentId=ref(''),topicId=ref(''),score=ref(80),note=ref('');
const goalTitle=ref(''),goalDescription=ref(''),goalTarget=ref(80),goalTopic=ref('');
const goalDate=ref(''),statusReason=ref('Dominio revisado con evidencia docente');
const busy=ref(false),error=ref(''),message=ref('');
let loadVersion=0,requestId='';
function newRequestId(){
  if(typeof crypto==='undefined'||typeof crypto.randomUUID!=='function'){
    throw Error('Tu navegador no admite identificadores seguros. Usa HTTPS o localhost.');
  }
  return crypto.randomUUID();
}
function api<T>(workspaceId:string,path:string,method='GET',body?:unknown){
  return apiJson<T>(workspacePath(workspaceId,'/learning-progress'+path),method,body);
}
const selectedStudent=computed(()=>course.value?.students.find(s=>s.id===studentId.value)??null);
const selectedTopic=computed(()=>course.value?.topics.find(t=>t.id===topicId.value)??null);
async function refresh(){
  const workspaceId=props.workspaceId,selected=courseId.value,version=++loadVersion;
  course.value=null;insights.value=null;error.value='';message.value='';
  if(!selected)return;
  loading.value=true;
  try{
    const [data,insightData]=await Promise.all([
      api<CourseProgress>(workspaceId,'/courses/'+encodeURIComponent(selected)),
      api<Insights>(workspaceId,'/courses/'+encodeURIComponent(selected)+'/insights'),
    ]);
    if(version!==loadVersion||workspaceId!==props.workspaceId||selected!==courseId.value)return;
    course.value=data;
    insights.value=insightData;
    if(!data.students.some(s=>s.id===studentId.value)){
      studentId.value=data.students[0]?.id??'';
    }
    if(!data.topics.some(t=>t.id===topicId.value)){
      topicId.value=data.topics[0]?.id??'';
    }
    if(!data.topics.some(t=>t.id===goalTopic.value))goalTopic.value='';
  }catch(e){
    if(version===loadVersion&&workspaceId===props.workspaceId){
      error.value=e instanceof Error?e.message:'No se pudo consultar el avance de este curso.';
    }
  }finally{if(version===loadVersion)loading.value=false;}
}
function focusInsight(insight:Insight){
 topicId.value=insight.topicId;
 goalTopic.value=insight.topicId;
 message.value='Seleccionaste '+insight.topicTitle+'. Puedes registrar una evaluación o preparar una práctica de refuerzo desde Clase Viva.';
}
async function addEvidence(){
 if(busy.value||!topicId.value||!studentId.value)return;
 const workspaceId=props.workspaceId;
 busy.value=true;error.value='';message.value='';
 try{
  if(!requestId)requestId=newRequestId();
  await api(workspaceId,'/evidence','POST',{
   topicId:topicId.value,studentUserId:studentId.value,
   requestId,score:score.value,note:note.value,
  });
  if(workspaceId!==props.workspaceId)return;
  requestId='';
  note.value='';
  await refresh();
  if(workspaceId===props.workspaceId)message.value='Evidencia docente registrada. El Pasaporte se actualizó.';
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo guardar la evaluación.';
  }
 }finally{busy.value=false;}
}
async function createGoal(){
 if(busy.value||!studentId.value||!courseId.value)return;
 const workspaceId=props.workspaceId;
 busy.value=true;error.value='';message.value='';
 try{
  await api(workspaceId,'/goals','POST',{
   courseId:courseId.value,studentUserId:studentId.value,
   title:goalTitle.value,description:goalDescription.value,
   targetMastery:goalTarget.value,...(goalTopic.value?{topicId:goalTopic.value}:{}),
   ...(goalDate.value?{targetAt:new Date(goalDate.value+'T23:59:00').toISOString()}:{}),
  });
  if(workspaceId!==props.workspaceId)return;
  goalTitle.value='';goalDescription.value='';goalDate.value='';
  await refresh();
  if(workspaceId===props.workspaceId)message.value='Meta asignada al estudiante.';
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo crear la meta.';
  }
 }finally{busy.value=false;}
}
async function changeGoal(goal:Goal,status:'ACHIEVED'|'CANCELLED'){
 if(busy.value)return;
 const workspaceId=props.workspaceId;
 busy.value=true;error.value='';message.value='';
 try{
  await api(workspaceId,'/goals/'+encodeURIComponent(goal.id)+'/status','PATCH',{
   status,reason:statusReason.value,
  });
  if(workspaceId!==props.workspaceId)return;
  await refresh();
  if(workspaceId===props.workspaceId){
   message.value=status==='ACHIEVED'?'Meta marcada como alcanzada.':'Meta cancelada; se preservó su historial.';
  }
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo actualizar la meta.';
  }
 }finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{
 ++loadVersion;course.value=null;insights.value=null;busy.value=false;error.value='';message.value='';
 courseId.value=props.courses[0]?.id??'';studentId.value='';topicId.value='';
 requestId='';void refresh();
});
watch(()=>props.courses,()=>{
 if(!props.courses.some(c=>c.id===courseId.value)){
   courseId.value=props.courses[0]?.id??'';
   void refresh();
 }
});
watch([studentId,topicId,note,score],()=>{requestId='';});
onMounted(()=>{
 courseId.value=props.courses[0]?.id??'';
 void refresh();
});
</script>
<template>
 <UiCard class="mt-6">
  <template #header>
   <div class="flex items-center gap-3"><TrendingUp :size="22" class="text-brand"/><div>
    <h2 class="text-lg font-extrabold">Competencias y metas de aprendizaje</h2>
    <p class="mt-1 text-xs text-muted">Registra evidencia evaluada por un docente y asigna objetivos específicos sin atribuir dominio a una IA.</p>
   </div></div>
  </template>
  <label class="block text-xs font-semibold">Curso
   <select v-model="courseId" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"
    @change="refresh">
    <option value="">Selecciona un curso</option>
    <option v-for="item in courses" :key="item.id" :value="item.id">{{item.title}}</option>
   </select>
  </label>
  <p v-if="loading" class="mt-3 text-xs text-muted">Consultando avance del curso…</p>
  <div v-else-if="course" class="mt-4 space-y-5">
   <section v-if="insights?.insights.length" class="rounded-xl border border-outline bg-surface-muted p-4">
    <h3 class="text-sm font-extrabold">Posibles actividades de refuerzo del grupo</h3>
    <p class="mt-2 text-xs text-muted">Estas señales provienen exclusivamente de metas con porcentaje objetivo y evaluaciones registradas por docentes.</p>
    <div class="mt-3 space-y-2">
     <article v-for="insight in insights.insights" :key="insight.topicId" class="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-outline bg-surface p-3">
      <div>
       <p class="text-sm font-bold">{{insight.topicTitle}}</p>
       <p v-if="insight.belowTargetCount" class="mt-1 text-xs text-muted">{{insight.belowTargetCount}} alumnos con evaluación docente por debajo de su meta definida.</p>
       <p v-if="insight.awaitingEvidenceCount" class="mt-1 text-xs text-muted">{{insight.awaitingEvidenceCount}} alumnos con meta, pero sin evaluación docente registrada.</p>
      </div>
      <UiButton size="sm" variant="secondary" @click="focusInsight(insight)">
       {{insight.action==='PREPARE_REINFORCEMENT'?'Planificar refuerzo':'Registrar evaluación'}}
      </UiButton>
     </article>
    </div>
    <p class="mt-3 text-xs text-muted">{{insights.disclaimer}}</p>
   </section>
   <p v-if="!course.students.length" class="text-xs text-muted">No hay estudiantes matriculados.</p>
   <div v-else>
    <label class="block text-xs font-semibold">Estudiante
     <select v-model="studentId" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
      <option v-for="student in course.students" :key="student.id" :value="student.id">{{student.name}}</option>
     </select>
    </label>
    <div v-if="selectedStudent" class="mt-5 grid gap-5 lg:grid-cols-2">
     <section class="rounded-xl border border-outline p-4">
      <h3 class="flex items-center gap-2 text-sm font-bold"><BookOpenCheck :size="17"/> Registrar evidencia</h3>
      <p class="mt-2 text-xs text-muted">La valoración se conserva como evidencia humana con fecha y evaluador. El porcentaje del Pasaporte corresponde al promedio de las valoraciones.</p>
      <form class="mt-3 space-y-3" @submit.prevent="addEvidence">
       <label class="block text-xs font-semibold">Competencia
        <select v-model="topicId" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
         <option v-for="topic in course.topics" :key="topic.id" :value="topic.id">{{topic.title}}</option>
        </select>
       </label>
       <label class="block text-xs font-semibold">Puntuación (0–100)
        <input v-model.number="score" required type="number" min="0" max="100" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/>
       </label>
       <label class="block text-xs font-semibold">Evidencia observada
        <textarea v-model="note" required minlength="10" maxlength="1500" rows="3" placeholder="Describe lo que demostró el alumno durante su aprendizaje" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea>
       </label>
       <p v-if="selectedTopic" class="text-xs text-muted">Competencia seleccionada: {{selectedTopic.title}}</p>
       <UiButton type="submit" :loading="busy" :disabled="busy||!topicId||!studentId">Guardar evidencia</UiButton>
      </form>
     </section>
     <section class="rounded-xl border border-outline p-4">
      <h3 class="flex items-center gap-2 text-sm font-bold"><Target :size="17"/> Nueva meta</h3>
      <p class="mt-2 text-xs text-muted">Un profesor marca manualmente su cumplimiento. Las prácticas automáticas no completan metas por sí solas.</p>
      <form class="mt-3 space-y-3" @submit.prevent="createGoal">
       <label class="block text-xs font-semibold">Título
        <input v-model="goalTitle" required minlength="3" maxlength="140" placeholder="Resolver ecuaciones sin ayuda" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/>
       </label>
       <label class="block text-xs font-semibold">Competencia (opcional)
        <select v-model="goalTopic" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
         <option value="">Meta general del curso</option>
         <option v-for="topic in course.topics" :key="topic.id" :value="topic.id">{{topic.title}}</option>
        </select>
       </label>
       <label class="block text-xs font-semibold">Porcentaje objetivo
        <input v-model.number="goalTarget" required type="number" min="1" max="100" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/>
       </label>
       <label class="block text-xs font-semibold">Fecha objetivo (opcional)
        <input v-model="goalDate" type="date" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/>
       </label>
       <label class="block text-xs font-semibold">Descripción
        <textarea v-model="goalDescription" maxlength="1200" rows="2" placeholder="Qué debe demostrar el alumno" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea>
       </label>
       <UiButton type="submit" :loading="busy" :disabled="busy||!studentId">Asignar meta</UiButton>
      </form>
     </section>
    </div>
    <section v-if="selectedStudent" class="mt-5 rounded-xl border border-outline p-4">
     <h3 class="text-sm font-bold">Evaluaciones verificadas</h3>
     <div v-if="selectedStudent.skills.length" class="mt-3 grid gap-2 md:grid-cols-2">
      <div v-for="item in selectedStudent.skills" :key="item.topicId" class="rounded-lg bg-surface-muted p-3">
       <p class="text-xs font-semibold">{{course.topics.find(t=>t.id===item.topicId)?.title||'Competencia'}}</p>
       <p class="mt-1 text-lg font-extrabold">{{item.mastery}}%</p>
       <p class="text-xs text-muted">{{item.evidenceCount}} {{item.evidenceCount===1?'evaluación':'evaluaciones'}} registradas</p>
      </div>
     </div>
     <p v-else class="mt-2 text-xs text-muted">No hay competencias evaluadas todavía.</p>
    </section>
    <section v-if="selectedStudent" class="mt-5 rounded-xl border border-outline p-4">
     <h3 class="text-sm font-bold">Metas asignadas</h3>
     <label v-if="selectedStudent.goals.some(g=>g.status==='ACTIVE')" class="mt-3 block text-xs font-semibold">Motivo del cambio de estado
      <input v-model="statusReason" maxlength="300" minlength="5" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/>
     </label>
     <div v-if="selectedStudent.goals.length" class="mt-3 space-y-2">
      <div v-for="goal in selectedStudent.goals" :key="goal.id" class="flex flex-wrap justify-between gap-3 rounded-lg bg-surface-muted p-3">
       <div>
        <p class="text-xs font-bold">{{goal.title}}</p>
        <p class="mt-1 text-xs text-muted">Objetivo: {{goal.targetMastery??'—'}}% · {{goal.status==='ACTIVE'?'En progreso':goal.status==='ACHIEVED'?'Alcanzada':'Cancelada'}}</p>
       </div>
       <div v-if="goal.status==='ACTIVE'" class="flex flex-wrap gap-2">
        <UiButton size="sm" :disabled="busy||statusReason.trim().length<5" @click="changeGoal(goal,'ACHIEVED')">Marcar alcanzada</UiButton>
        <UiButton size="sm" variant="secondary" :disabled="busy||statusReason.trim().length<5" @click="changeGoal(goal,'CANCELLED')">Cancelar</UiButton>
       </div>
      </div>
     </div>
     <p v-else class="mt-2 text-xs text-muted">Aún no hay metas para este estudiante.</p>
    </section>
   </div>
   <p v-if="!course.topics.length" class="text-xs text-muted">Primero crea al menos un tema en el programa del curso para registrar evidencias de competencias.</p>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="message" tone="success" class="mt-4">{{message}}</UiAlert>
 </UiCard>
</template>
