<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {CheckCircle2,ClipboardCheck,RotateCcw,TrendingUp} from 'lucide-vue-next';
const props=defineProps<{workspaceId:string}>();
type PublicQuestion={prompt:string;options:string[]};
type Practice={
  id:string;title:string;sessionTitle:string;courseId:string|null;
  questions:PublicQuestion[];lastAttempt:{id:string;score:number|null;createdAt:string}|null;
};
type Passport={courseId:string;title:string;subject:string;attempts:number;averageScore:number|null;metric:string};
type AttemptResult={score:number;correct:number;total:number;attemptNumber:number;feedback:Array<{correct:boolean;correctIndex:number;explanation:string}>};
const loading=ref(true),busy=ref(''),error=ref(''),notice=ref('');
const practices=ref<Practice[]>([]),passport=ref<Passport[]>([]);
const selected=ref<Record<string,Record<number,number>>>({});
const results=ref<Record<string,AttemptResult>>({});
const optionLetters=['A','B','C','D'];

async function fetchJson<T>(path:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch('/api/v1/workspaces/'+props.workspaceId+'/practice'+path,{
    method,credentials:'same-origin',
    ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),
  });
  const value:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    const reason=(value&&typeof value==='object'&&'message' in value&&typeof value.message==='string')?value.message:'No se pudo guardar tu práctica.';
    throw new Error(reason);
  }
  return value as T;
}
async function load(){
  loading.value=true;error.value='';
  try{
    const [activities,progress]=await Promise.all([
      fetchJson<Practice[]>('/student'),
      fetchJson<Passport[]>('/passport'),
    ]);
    practices.value=activities;passport.value=progress;
  }catch(e){error.value=e instanceof Error?e.message:'No pudimos cargar tu aprendizaje.';}
  finally{loading.value=false;}
}
function choose(activityId:string,questionIndex:number,optionIndex:number){
  selected.value={...selected.value,[activityId]:{...(selected.value[activityId]??{}),[questionIndex]:optionIndex}};
}
async function submit(activity:Practice){
  const answers=activity.questions.map((_,i)=>selected.value[activity.id]?.[i]);
  if(answers.some(a=>a===undefined)){error.value='Responde todas las preguntas antes de enviar.';return;}
  busy.value=activity.id;error.value='';notice.value='';
  try{
    const result=await fetchJson<AttemptResult>('/'+activity.id+'/attempts','POST',{answers});
    results.value={...results.value,[activity.id]:result};
    notice.value='Práctica entregada y corregida.';
    const passportResult=await fetchJson<Passport[]>('/passport');
    passport.value=passportResult;
    practices.value=await fetchJson<Practice[]>('/student');
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo entregar la práctica.';}
  finally{busy.value='';}
}
watch(()=>props.workspaceId,()=>{selected.value={};results.value={};load();});
onMounted(load);
</script>
<template>
<section class="space-y-5">
  <div class="flex items-center gap-3"><TrendingUp :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Mi Pasaporte</h2><p class="mt-1 text-xs text-muted">Resultados basados únicamente en ejercicios que has completado.</p></div></div>
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