<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {BookOpen,ShieldCheck,UsersRound} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Link={id:string;studentUserId:string;student:{id:string;name:string}};
type Course={
 courseId:string;title:string;subject:string;
 skills:Array<{topic:string;mastery:number;evidenceCount:number}>;
 goals:Array<{title:string;status:'ACTIVE'|'ACHIEVED'|'CANCELLED';targetMastery:number|null}>;
};
type Overview={student:{id:string;name:string};courses:Course[]};
const props=defineProps<{workspaceId:string}>();
const links=ref<Link[]>([]),studentId=ref(''),overview=ref<Overview|null>(null);
const loading=ref(true),busy=ref(false),error=ref(''),notice=ref('');
let loadVersion=0;
function api<T>(workspaceId:string,path:string,method='GET',body?:unknown){
 return apiJson<T>(workspacePath(workspaceId,'/guardians'+path),method,body);
}
async function load(){
 const workspaceId=props.workspaceId,version=++loadVersion;
 loading.value=true;links.value=[];overview.value=null;error.value='';
 try{
  const data=await api<Link[]>(workspaceId,'/students');
  if(version!==loadVersion||workspaceId!==props.workspaceId)return;
  links.value=data;
  studentId.value=data.find(item=>item.studentUserId===studentId.value)?.studentUserId??data[0]?.studentUserId??'';
  if(studentId.value){
   const detail=await api<Overview>(workspaceId,'/students/'+encodeURIComponent(studentId.value)+'/overview');
   if(version!==loadVersion||workspaceId!==props.workspaceId)return;
   overview.value=detail;
  }
 }catch(e){
  if(version===loadVersion&&workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo consultar el resumen familiar.';
  }
 }finally{if(version===loadVersion)loading.value=false;}
}
async function selectStudent(id:string){
 const workspaceId=props.workspaceId,version=++loadVersion;
 studentId.value=id;overview.value=null;loading.value=true;error.value='';
 try{
  const detail=await api<Overview>(workspaceId,'/students/'+encodeURIComponent(id)+'/overview');
  if(version===loadVersion&&workspaceId===props.workspaceId)overview.value=detail;
 }catch(e){
  if(version===loadVersion&&workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'Acceso familiar no disponible.';
  }
 }finally{if(version===loadVersion)loading.value=false;}
}
async function revoke(){
 const item=links.value.find(link=>link.studentUserId===studentId.value);
 if(!item||busy.value||!window.confirm('¿Retirar tu acceso familiar? La academia deberá verificar nuevamente el vínculo.'))return;
 const workspaceId=props.workspaceId;
 busy.value=true;error.value='';
 try{
  await api(workspaceId,'/links/'+encodeURIComponent(item.id)+'/revoke','PATCH',{
   reason:'Acceso familiar revocado voluntariamente por el acudiente',
  });
  if(workspaceId!==props.workspaceId)return;
  await load();
  if(workspaceId===props.workspaceId)notice.value='Tu acceso familiar fue retirado.';
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo retirar el acceso.';
  }
 }finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{
 ++loadVersion;studentId.value='';busy.value=false;notice.value='';void load();
});
onMounted(()=>void load());
</script>
<template>
 <section class="mx-auto max-w-5xl p-5 md:p-8">
  <div class="flex items-center gap-3"><UsersRound :size="29" class="text-brand"/><div>
   <h1 class="text-2xl font-extrabold">Portal de acudientes</h1>
   <p class="mt-1 text-sm text-muted">Consulta únicamente información académica de estudiantes expresamente autorizados.</p>
  </div></div>
  <UiAlert tone="warning" class="mt-5">
   AcademyOS no certifica la identidad ni el parentesco. La academia debe comprobar la autorización legal fuera de la plataforma.
   Este portal no muestra materiales privados, enlaces de clases, documentos o datos de contacto de terceros.
  </UiAlert>
  <UiCard class="mt-5">
   <template #header><h2 class="text-lg font-bold">Estudiantes vinculados</h2></template>
   <p v-if="loading" class="text-sm text-muted">Consultando permisos…</p>
   <div v-else-if="links.length" class="flex flex-wrap items-end gap-3">
    <label class="text-xs font-semibold">Estudiante
     <select :value="studentId" class="mt-2 block rounded-xl border border-outline bg-surface p-3 text-sm"
      @change="selectStudent(($event.target as HTMLSelectElement).value)">
      <option v-for="link in links" :key="link.id" :value="link.studentUserId">{{link.student.name}}</option>
     </select>
    </label>
    <UiButton size="sm" variant="secondary" :disabled="busy" @click="revoke">Revocar mi acceso</UiButton>
   </div>
   <p v-else class="text-sm text-muted">Todavía no tienes estudiantes con un vínculo familiar verificado y aprobado por esta academia. La invitación como acudiente no concede acceso automático.</p>
  </UiCard>
  <div v-if="overview" class="mt-5 space-y-4">
   <h2 class="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck :size="19" class="text-brand"/> Resumen de {{overview.student.name}}</h2>
   <UiCard v-for="course in overview.courses" :key="course.courseId">
    <template #header><h3 class="text-base font-bold"><BookOpen :size="17" class="mr-2 inline text-brand"/>{{course.title}}</h3></template>
    <p class="text-xs text-muted">{{course.subject}}</p>
    <div v-if="course.skills.length" class="mt-4 grid gap-2 sm:grid-cols-2">
     <div v-for="skill in course.skills" :key="skill.topic" class="rounded-xl bg-surface-muted p-3">
      <p class="text-xs font-semibold">{{skill.topic}}</p>
      <p class="mt-1 text-xl font-extrabold">{{skill.mastery}}%</p>
      <p class="mt-1 text-xs text-muted">{{skill.evidenceCount}} evidencias revisadas</p>
     </div>
    </div>
    <div v-if="course.goals.length" class="mt-4 space-y-2">
     <h4 class="text-sm font-bold">Metas</h4>
     <p v-for="(goal,i) in course.goals" :key="i" class="rounded-lg bg-surface-muted px-3 py-2 text-xs">
      {{goal.title}} · {{goal.status==='ACTIVE'?'En curso':goal.status==='ACHIEVED'?'Alcanzada':'Cancelada'}}
     </p>
    </div>
   </UiCard>
   <p v-if="!overview.courses.length" class="text-sm text-muted">Este estudiante no tiene cursos con matrícula activa.</p>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-5">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-5">{{notice}}</UiAlert>
 </section>
</template>
