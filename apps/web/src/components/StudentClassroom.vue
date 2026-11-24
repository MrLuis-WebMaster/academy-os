<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {UiAlert,UiEmptyState} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
import {BookOpen,CalendarDays,ExternalLink,FolderOpen,GraduationCap,MapPin,Video} from 'lucide-vue-next';
import StudentPractice from './StudentPractice.vue';
import LearningAssetsStudent from './LearningAssetsStudent.vue';
import PackageOrdersStudent from './PackageOrdersStudent.vue';
import StudentBookings from './StudentBookings.vue';
import StudentTutor from './StudentTutor.vue';

const props=defineProps<{workspace:{id:string;name:string}}>();
type Lesson={id:string;title:string;startsAt:string;seriesId:string|null;seriesIndex:number|null;mode:'ONLINE'|'ONSITE'|'HYBRID';meetingUrl:string|null;location:string|null};
type Enrollment={id:string;course:{id:string;title:string;summary:string|null;requiresPackage:boolean;subject:{name:string}|null;resources:{id:string;title:string;source:string;url:string|null}[];sessions:Lesson[]}};
type PublishedNotes={id:string;notes:string;approvedAt:string|null;session:{id:string;courseId:string|null;title:string}};

const lessonNotes=ref<PublishedNotes[]>([]);
const courses=ref<Enrollment[]>([]);
const loading=ref(true),error=ref(''),notesWarning=ref('');
let loadVersion=0;
const refreshingLinks=ref(false);
async function refreshMeetingLinks(){
 const workspaceId=props.workspace.id,version=++loadVersion;
 // Immediately remove old links after cancellations, even if refresh fails.
 courses.value=courses.value.map(e=>({...e,course:{...e.course,sessions:e.course.sessions.map(s=>({...s,meetingUrl:null}))}}));
 refreshingLinks.value=true;
 try{
  const rows=await apiJson<Enrollment[]>(workspacePath(workspaceId,'/classroom'));
  if(version===loadVersion&&workspaceId===props.workspace.id)courses.value=rows;
 }catch{
  if(version===loadVersion&&workspaceId===props.workspace.id)notesWarning.value='No se pudieron actualizar los enlaces de reunión. Vuelve a consultar las clases.';
 }finally{if(version===loadVersion)refreshingLinks.value=false;}
}

async function load(){
  const version=++loadVersion;
  const workspaceId=props.workspace.id;
  loading.value=true;
  refreshingLinks.value=false;
  error.value='';
  notesWarning.value='';
  courses.value=[];
  lessonNotes.value=[];
  const [enrollments,notes]=await Promise.allSettled([
    apiJson<Enrollment[]>(workspacePath(workspaceId,'/classroom')),
    apiJson<PublishedNotes[]>(workspacePath(workspaceId,'/class-alive/published')),
  ]);
  // Responses from a former academy must never overwrite the new academy's view.
  if(version!==loadVersion||workspaceId!==props.workspace.id)return;
  if(enrollments.status==='rejected'){
    error.value=enrollments.reason instanceof Error?enrollments.reason.message:'No se pudieron cargar tus cursos.';
    loading.value=false;
    return;
  }
  courses.value=enrollments.value;
  if(notes.status==='fulfilled')lessonNotes.value=notes.value;
  else notesWarning.value='No pudimos cargar las notas de Clase Viva. Tus cursos y materiales siguen disponibles.';
  loading.value=false;
}
onMounted(()=>void load());
watch(()=>props.workspace.id,()=>void load());
</script>
<template>
<main class="mx-auto max-w-5xl p-6 md:p-10"><div class="mb-8"><span class="text-xs font-extrabold tracking-widest text-brand">AULA DIGITAL</span><h1 class="mt-3 text-3xl font-extrabold">Mis clases en {{ workspace.name }}</h1><p class="mt-3 text-sm text-muted">Tu agenda, tus materiales y tus cursos en un mismo lugar.</p><button v-if="!loading&&!error" type="button" :disabled="refreshingLinks" class="mt-3 text-xs font-bold text-brand disabled:opacity-50" @click="refreshMeetingLinks">{{refreshingLinks?'Actualizando…':'Actualizar clases y enlaces'}}</button></div>
<UiAlert v-if="notesWarning && !loading && !error" tone="warning" class="mb-5">{{notesWarning}}</UiAlert>
<p v-if="loading" class="rounded-xl bg-surface p-6 text-sm text-muted">Cargando tus clases...</p><p v-else-if="error" role="alert" class="rounded-xl bg-danger-soft p-6 text-sm text-danger">{{ error }}</p>
<UiEmptyState v-else-if="!courses.length" title="Tu espacio ya está listo" description="Cuando el administrador te inscriba en un curso, encontrarás aquí tus clases y materiales."><template #icon><GraduationCap :size="27" /></template></UiEmptyState>
<div v-else class="space-y-5"><section v-for="enrollment in courses" :key="enrollment.id" class="rounded-2xl border border-outline bg-surface p-6"><div class="flex items-center gap-3"><div class="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><BookOpen :size="24"/></div><div><p class="text-xs font-bold text-brand">{{ enrollment.course.subject?.name || 'Curso' }}</p><h2 class="mt-1 text-lg font-extrabold">{{ enrollment.course.title }}</h2>
<p v-if="enrollment.course.requiresPackage" class="mt-2 text-xs font-semibold text-warning">Las nuevas reservas consumen un crédito de paquete</p></div></div><p v-if="enrollment.course.summary" class="mt-4 text-sm text-muted">{{ enrollment.course.summary }}</p>
<div v-if="lessonNotes.some(n=>n.session.courseId===enrollment.course.id)" class="mt-5 rounded-xl bg-brand-soft p-4"><h3 class="text-sm font-extrabold text-brand">Clase Viva · resumen del profesor</h3><div v-for="note in lessonNotes.filter(n=>n.session.courseId===enrollment.course.id)" :key="note.id" class="mt-3 border-t border-outline pt-3"><p class="text-xs font-bold">{{ note.session.title }}</p><p class="mt-1 whitespace-pre-wrap text-sm leading-6">{{ note.notes }}</p></div></div>
<div class="mt-7 grid gap-5 md:grid-cols-2"><div><h3 class="flex items-center gap-2 text-sm font-extrabold"><CalendarDays :size="17"/> Sesiones</h3><div v-for="session in enrollment.course.sessions" :key="session.id" class="mt-3 rounded-xl bg-surface-muted p-4"><p class="text-sm font-semibold">{{ session.title }}</p><p class="mt-1 text-xs text-muted">{{ new Date(session.startsAt).toLocaleString('es-CO') }}</p><p v-if="session.location" class="mt-2 flex items-center gap-1 text-xs text-muted"><MapPin :size="13"/>{{ session.location }}</p><a v-if="session.meetingUrl" :href="session.meetingUrl" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"><Video :size="14"/> Entrar a la clase <ExternalLink :size="13"/></a><p v-else-if="session.mode!=='ONSITE'" class="mt-2 text-xs text-muted">El enlace estará disponible con una reserva activa cuando tu profesor lo publique.</p></div><p v-if="!enrollment.course.sessions.length" class="mt-3 text-xs text-muted">Todavía no hay sesiones agendadas.</p></div><div><h3 class="flex items-center gap-2 text-sm font-extrabold"><FolderOpen :size="17"/> Materiales</h3><div v-for="resource in enrollment.course.resources" :key="resource.id" class="mt-3 rounded-xl border border-outline p-4"><p class="text-sm font-medium">{{ resource.title }}</p><a v-if="resource.source==='UPLOAD'" :href="workspacePath(workspace.id,'/material-files/'+encodeURIComponent(resource.id)+'/download')" download class="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand">Descargar archivo <ExternalLink :size="13"/></a><a v-else-if="resource.url" :href="resource.url" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand">Abrir recurso <ExternalLink :size="13"/></a></div><p v-if="!enrollment.course.resources.length" class="mt-3 text-xs text-muted">Aún no hay materiales publicados.</p></div></div></section></div>
<div v-if="!loading && !error" class="mt-8"><StudentBookings :workspace-id="workspace.id" :sessions="courses.flatMap(enrollment=>
 enrollment.course.sessions.map(session=>({
  ...session,requiresPackage:enrollment.course.requiresPackage,
 })))" @updated="refreshMeetingLinks" />
<PackageOrdersStudent :workspace-id="workspace.id" />
<StudentPractice :workspace-id="workspace.id" />
<LearningAssetsStudent :workspace-id="workspace.id" />
<StudentTutor :workspace-id="workspace.id" :courses="courses.map(x=>x.course)" /></div>
</main>
</template>
