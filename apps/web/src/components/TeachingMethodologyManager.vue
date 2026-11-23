<script setup lang="ts">
import {computed,ref,watch,onMounted} from 'vue';
import {BrainCircuit,ShieldCheck,SlidersHorizontal} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Teacher={id:string;userId:string;user:{name:string}};
type Method={
 specialty:'GENERAL'|'LANGUAGES'|'MATHEMATICS'|'MUSIC'|'ART_DESIGN'|'SCHOOL_SUPPORT'|'EXAM_PREP';
 style:'SOCRATIC'|'STEP_BY_STEP'|'CONVERSATIONAL'|'PRACTICAL'|'VISUAL';
 language:'es'|'en'|'pt'|'fr';guidance:string;sosEnabled:boolean;
};
const props=defineProps<{
 workspaceId:string;role:string;actorId:string;teachers:Teacher[];
}>();
const allowedTeachers=computed(()=>['OWNER','ADMIN'].includes(props.role)?
 props.teachers:props.teachers.filter(t=>t.userId===props.actorId));
const teacherId=ref(''),method=ref<Method>({
 specialty:'GENERAL',style:'SOCRATIC',language:'es',guidance:'',sosEnabled:false,
});
const specialties=[
 ['GENERAL','General'],['LANGUAGES','Idiomas'],['MATHEMATICS','Matemáticas'],
 ['MUSIC','Música'],['ART_DESIGN','Arte y diseño'],['SCHOOL_SUPPORT','Refuerzo escolar'],
 ['EXAM_PREP','Preparación de exámenes'],
] as const;
const styles=[
 ['SOCRATIC','Preguntas y pistas'],['STEP_BY_STEP','Explicar paso a paso'],
 ['CONVERSATIONAL','Conversación'],['PRACTICAL','Casos prácticos'],['VISUAL','Explicación visual'],
] as const;
const busy=ref(false),loading=ref(false),error=ref(''),notice=ref('');
let version=0;
async function load(){
 const workspace=props.workspaceId,id=teacherId.value,n=++version;
 error.value='';notice.value='';
 if(!id)return;
 loading.value=true;
 try{
  const result=await apiJson<Method>(workspacePath(workspace,'/teaching-methods/'+encodeURIComponent(id)));
  if(n!==version||workspace!==props.workspaceId||id!==teacherId.value)return;
  method.value=result;
 }catch(e){
  if(n===version&&workspace===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo cargar la metodología.';
  }
 }finally{if(n===version)loading.value=false;}
}
async function save(){
 const workspace=props.workspaceId,id=teacherId.value;
 if(busy.value||!id)return;
 busy.value=true;error.value='';notice.value='';
 try{
  method.value=await apiJson<Method>(
   workspacePath(workspace,'/teaching-methods/'+encodeURIComponent(id)),
   'PUT',method.value,
  );
  if(workspace===props.workspaceId&&id===teacherId.value){
   notice.value='Metodología guardada para este profesor.';
  }
 }catch(e){
  if(workspace===props.workspaceId&&id===teacherId.value){
   error.value=e instanceof Error?e.message:'No se pudo guardar la metodología.';
  }
 }finally{busy.value=false;}
}
function syncTeacher(){
 if(!allowedTeachers.value.some(item=>item.id===teacherId.value)){
  teacherId.value=allowedTeachers.value[0]?.id??'';
  void load();
 }
}
watch(()=>[props.workspaceId,props.actorId,props.role],()=>{
 ++version;teacherId.value='';syncTeacher();
});
watch(()=>props.teachers,syncTeacher);
watch(teacherId,()=>void load());
onMounted(syncTeacher);
</script>
<template>
 <UiCard class="mt-6">
  <template #header>
   <div class="flex items-center gap-3"><BrainCircuit :size="22" class="text-brand"/><div>
    <h2 class="text-lg font-extrabold">Mi metodología · Profe SOS</h2>
    <p class="mt-1 text-xs text-muted">La enseñanza y el asistente se adaptan a cada profesor, incluso si comparten academia.</p>
   </div></div>
  </template>
  <p v-if="!allowedTeachers.length" class="text-xs text-muted">Todavía no tienes un perfil de profesor en esta academia.</p>
  <div v-else class="space-y-4">
   <label class="block text-xs font-semibold">Profesor
    <select v-model="teacherId" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
     <option v-for="teacher in allowedTeachers" :key="teacher.id" :value="teacher.id">{{teacher.user.name}}</option>
    </select>
   </label>
   <p v-if="loading" class="text-xs text-muted">Cargando configuración…</p>
   <form v-else class="space-y-4" @submit.prevent="save">
    <div class="grid gap-3 sm:grid-cols-2">
     <label class="text-xs font-semibold">Especialidad
      <select v-model="method.specialty" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
       <option v-for="choice in specialties" :key="choice[0]" :value="choice[0]">{{choice[1]}}</option>
      </select>
     </label>
     <label class="text-xs font-semibold">Estilo pedagógico
      <select v-model="method.style" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
       <option v-for="choice in styles" :key="choice[0]" :value="choice[0]">{{choice[1]}}</option>
      </select>
     </label>
     <label class="text-xs font-semibold">Idioma de las explicaciones
      <select v-model="method.language" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
       <option value="es">Español</option><option value="en">English</option>
       <option value="pt">Português</option><option value="fr">Français</option>
      </select>
     </label>
     <label class="text-xs font-semibold">Estado de Profe SOS
      <select v-model="method.sosEnabled" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
       <option :value="false">Desactivado</option><option :value="true">Habilitado para mis cursos</option>
      </select>
     </label>
    </div>
    <label class="block text-xs font-semibold">Indicaciones de tu metodología
     <textarea v-model="method.guidance" rows="4" maxlength="1200"
      placeholder="Ej. Primero pregunta al estudiante cómo resolvería el ejercicio; después propón una pista. En conversación prioriza pronunciación..."
      class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea>
    </label>
    <p class="flex items-start gap-2 text-xs text-muted"><SlidersHorizontal :size="15" class="shrink-0"/>
     Tu metodología guía las propuestas de Clase Viva. Profe SOS usa únicamente notas publicadas de docentes habilitados y no envía datos personales ni perfiles privados del alumno.
    </p>
    <p class="flex items-start gap-2 text-xs text-muted"><ShieldCheck :size="15" class="shrink-0"/>
     Habilitar Profe SOS no activa por sí mismo un proveedor de IA: el servicio debe estar configurado, y cada estudiante debe consentir el envío de su pregunta.
    </p>
    <UiButton type="submit" :loading="busy" :disabled="busy||loading||!teacherId">Guardar metodología</UiButton>
   </form>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-4">{{notice}}</UiAlert>
 </UiCard>
</template>
