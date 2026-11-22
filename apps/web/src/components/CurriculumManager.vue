<script setup lang="ts">
import { apiJson, workspacePath } from '../shared/api-client';
import {onMounted,ref,watch} from 'vue';
import {Layers3,Plus} from 'lucide-vue-next';
const props=defineProps<{
 workspaceId:string;role:string;
 courses:Array<{id:string;title:string}>;
 teachers:Array<{id:string;user:{name:string}}>;
}>();
type Topic={id:string;title:string;parentId:string|null;order:number};
type TeacherAssignment={teacherId:string;teacher:{user:{name:string}}};
type Detail={courseId:string;topics:Topic[];teachers:TeacherAssignment[]};
const courseId=ref(''),selectedTeacher=ref(''),topic=ref(''),parentId=ref(''),detail=ref<Detail|null>(null);
const busy=ref(false),error=ref(''),message=ref('');
async function request<T>(suffix:string,method='GET',body?:unknown):Promise<T>{
  return apiJson<T>(workspacePath(props.workspaceId,'/curriculum/courses/'+encodeURIComponent(courseId.value)+suffix),method,body);
}
async function load(){
 error.value='';
 if(!courseId.value){detail.value=null;return;}
 try{detail.value=await request<Detail>('');}
 catch(e){error.value=e instanceof Error?e.message:'No pudimos cargar el programa.';}
}
async function addTopic(){
 busy.value=true;error.value='';message.value='';
 try{
  await request('/topics','POST',{title:topic.value,...(parentId.value?{parentId:parentId.value}:{})});
  topic.value='';await load();message.value='Tema añadido al programa.';
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo añadir el tema';}
 finally{busy.value=false;}
}
async function assign(){
 busy.value=true;error.value='';message.value='';
 try{await request('/teachers','POST',{teacherId:selectedTeacher.value});await load();message.value='Profesor asignado a este curso.';}
 catch(e){error.value=e instanceof Error?e.message:'No se pudo asignar al profesor';}
 finally{busy.value=false;}
}
async function unassign(teacherId:string){
 if(!window.confirm('¿Quitar a este profesor del curso?'))return;
 busy.value=true;error.value='';message.value='';
 try{await request('/teachers/'+teacherId,'DELETE');await load();message.value='Asignación eliminada.';}
 catch(e){error.value=e instanceof Error?e.message:'No se pudo quitar al profesor';}
 finally{busy.value=false;}
}
watch(courseId,load);
watch(()=>props.workspaceId,()=>{courseId.value='';detail.value=null;});
onMounted(load);
</script>
<template>
<section class="mt-6 rounded-2xl border border-outline bg-surface p-6">
 <div class="flex items-center gap-2"><Layers3 :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Programas y docentes</h2><p class="mt-1 text-xs text-muted">Organiza unidades y temas; un curso puede tener varios profesores.</p></div></div>
 <label class="mt-5 block max-w-md text-xs font-bold">Curso<select v-model="courseId" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"><option value="">Seleccionar curso</option><option v-for="course in courses" :key="course.id" :value="course.id">{{ course.title }}</option></select></label>
 <p v-if="error" role="alert" class="mt-4 rounded-xl bg-danger-soft p-3 text-xs text-danger">{{ error }}</p>
 <p v-if="message" role="status" class="mt-4 rounded-xl bg-success-soft p-3 text-xs text-success">{{ message }}</p>
 <div v-if="detail" class="mt-6 grid gap-6 md:grid-cols-2">
  <div><h3 class="text-sm font-extrabold">Temario</h3>
   <form class="mt-3 space-y-3" @submit.prevent="addTopic">
    <input v-model="topic" required minlength="2" maxlength="140" placeholder="Ej. Funciones y ecuaciones" class="w-full rounded-xl border border-outline p-3 text-sm"/>
    <select v-model="parentId" class="w-full rounded-xl border border-outline bg-surface p-3 text-sm"><option value="">Tema principal</option><option v-for="item in detail.topics" :key="item.id" :value="item.id">Subtema de: {{ item.title }}</option></select>
    <button :disabled="busy" class="flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><Plus :size="15"/> Añadir tema</button>
   </form>
   <div class="mt-4 space-y-2"><div v-for="item in detail.topics" :key="item.id" class="rounded-lg bg-surface-muted px-4 py-3 text-sm" :class="item.parentId?'ml-5':''">{{ item.parentId?'↳ ':'' }}{{ item.title }}</div><p v-if="!detail.topics.length" class="text-xs text-muted">Este programa aún no tiene temas.</p></div>
  </div>
  <div><h3 class="text-sm font-extrabold">Profesores asignados</h3>
   <form v-if="['OWNER','ADMIN'].includes(role)" class="mt-3 flex flex-wrap gap-2" @submit.prevent="assign">
    <select v-model="selectedTeacher" required class="min-w-0 flex-1 rounded-xl border border-outline bg-surface p-3 text-sm"><option value="">Elegir profesor</option><option v-for="person in teachers" :key="person.id" :value="person.id">{{ person.user.name }}</option></select>
    <button :disabled="busy" class="rounded-xl bg-brand px-4 py-3 text-xs font-bold text-white disabled:opacity-50">Asignar</button>
   </form>
   <div class="mt-4 space-y-2"><div v-for="assignment in detail.teachers" :key="assignment.teacherId" class="flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-4 py-3 text-sm"><span>{{ assignment.teacher.user.name }}</span><button v-if="['OWNER','ADMIN'].includes(role)" :disabled="busy" class="text-xs font-bold text-rose-600" @click="unassign(assignment.teacherId)">Quitar</button></div><p v-if="!detail.teachers.length" class="text-xs text-muted">Todavía no hay docentes asignados.</p></div>
  </div>
 </div>
</section>
</template>
