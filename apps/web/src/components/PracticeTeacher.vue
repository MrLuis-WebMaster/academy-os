<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {BookOpenCheck,Plus,Send} from 'lucide-vue-next';

type Lesson={id:string;courseId:string|null;title:string};
type Practice={id:string;title:string;publishedAt:string|null;reflection:{sessionId:string;session:{title:string;courseId:string|null}};_count:{attempts:number}};
const props=defineProps<{workspaceId:string;sessions:Lesson[]}>();
const practices=ref<Practice[]>([]);
const selectedSession=ref(''),title=ref(''),prompt=ref('');
const options=ref(['','','','']),correctIndex=ref(0),explanation=ref('');
const busy=ref(false),loading=ref(false),error=ref(''),message=ref('');

async function request<T>(endpoint:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch('/api/v1/workspaces/'+props.workspaceId+'/practice'+endpoint,{
    method,credentials:'same-origin',
    ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),
  });
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    const reason=(data&&typeof data==='object'&&'message' in data&&typeof data.message==='string')?data.message:'No se pudo completar la operación.';
    throw new Error(reason);
  }
  return data as T;
}
async function refresh(){
  loading.value=true;
  try{practices.value=await request<Practice[]>('/teacher');}
  catch(e){error.value=e instanceof Error?e.message:'No se pudieron cargar las prácticas.';}
  finally{loading.value=false;}
}
async function create(){
  busy.value=true;error.value='';message.value='';
  try{
    await request('', 'POST',{
      sessionId:selectedSession.value,title:title.value,
      questions:[{prompt:prompt.value,options:options.value,correctIndex:correctIndex.value,explanation:explanation.value}],
    });
    title.value='';prompt.value='';options.value=['','','',''];explanation.value='';
    await refresh();message.value='Práctica guardada como borrador. Publícala después de aprobar las notas de Clase Viva.';
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo crear el ejercicio.';}
  finally{busy.value=false;}
}
async function publish(id:string){
  if(!window.confirm('¿Publicar este ejercicio para los alumnos inscritos?'))return;
  busy.value=true;error.value='';message.value='';
  try{await request('/'+id+'/publish','POST');await refresh();message.value='Ejercicio disponible para los alumnos inscritos.';}
  catch(e){error.value=e instanceof Error?e.message:'No se pudo publicar la práctica.';}
  finally{busy.value=false;}
}
watch(()=>props.workspaceId,refresh);
onMounted(refresh);
</script>

<template>
<section class="mt-6 rounded-2xl border border-outline bg-surface p-6">
  <div class="flex items-center gap-3"><BookOpenCheck :size="21" class="text-brand"/><div><h2 class="text-lg font-extrabold">Prácticas de Clase Viva</h2><p class="mt-1 text-xs text-muted">Crea ejercicios corregibles para una sesión con notas guardadas. El profesor siempre revisa lo que se publica.</p></div></div>
  <form class="mt-5 grid gap-3 md:grid-cols-2" @submit.prevent="create">
    <label class="text-xs font-semibold">Sesión vinculada a un curso
      <select v-model="selectedSession" required class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"><option value="">Elige la sesión</option><option v-for="session in sessions.filter(s=>s.courseId)" :key="session.id" :value="session.id">{{ session.title }}</option></select>
    </label>
    <label class="text-xs font-semibold">Título<input v-model="title" required minlength="3" maxlength="120" placeholder="Ej. Reto de ecuaciones" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"/></label>
    <label class="text-xs font-semibold md:col-span-2">Pregunta<input v-model="prompt" required minlength="8" maxlength="500" placeholder="¿Cuál es el valor de x en x + 5 = 10?" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"/></label>
    <label v-for="i in 4" :key="i" class="text-xs font-semibold">Opción {{ i }}<input v-model="options[i-1]" required maxlength="180" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm" :placeholder="'Respuesta '+i"/></label>
    <label class="text-xs font-semibold">Respuesta correcta<select v-model.number="correctIndex" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"><option v-for="i in 4" :key="i" :value="i-1">Opción {{ i }}</option></select></label>
    <label class="text-xs font-semibold">Explicación opcional<input v-model="explanation" maxlength="500" placeholder="Explica por qué es correcta" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"/></label>
    <button class="flex items-center justify-center gap-2 rounded-xl bg-brand p-3 text-xs font-bold text-white disabled:opacity-50 md:col-span-2" :disabled="busy || !sessions.some(s=>s.courseId)"><Plus :size="17"/> Crear ejercicio como borrador</button>
  </form>
  <p v-if="error" role="alert" class="mt-3 rounded-lg bg-danger-soft p-3 text-xs text-danger">{{ error }}</p>
  <p v-if="message" role="status" class="mt-3 rounded-lg bg-success-soft p-3 text-xs text-success">{{ message }}</p>
  <p v-if="loading" class="mt-4 text-xs text-muted">Cargando ejercicios...</p>
  <div v-else class="mt-5 space-y-2">
    <div v-for="practice in practices" :key="practice.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline p-3">
      <div><p class="text-sm font-bold">{{ practice.title }}</p><p class="mt-1 text-xs text-muted">{{ practice.reflection.session.title }} · {{ practice._count.attempts }} respuestas</p></div>
      <span v-if="practice.publishedAt" class="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">Publicado</span>
      <button v-else :disabled="busy" class="flex items-center gap-1 rounded-lg bg-brand-soft px-3 py-2 text-xs font-bold text-brand disabled:opacity-50" @click="publish(practice.id)"><Send :size="14"/> Publicar</button>
    </div>
    <p v-if="!practices.length" class="text-xs text-muted">No hay prácticas todavía. Primero registra las observaciones de una clase.</p>
  </div>
</section>
</template>