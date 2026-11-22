<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import PracticeTeacher from './PracticeTeacher.vue';
import StudioEditor from './StudioEditor.vue';
import StaffAttendance from './StaffAttendance.vue';
import FinanceLedger from './FinanceLedger.vue';
import { BookOpen, CalendarDays, GraduationCap, Plus, RefreshCcw, Users, Video, MapPin, CheckCircle2 } from 'lucide-vue-next';
const props = defineProps<{ workspace: { id: string; name: string; type: 'SOLO'|'ACADEMY' }; role: string }>();
type Subject = { id:string; name:string };
type Course = { id:string; title:string; summary:string|null; subjectId:string|null };
type Teacher = { id:string; userId:string; user:{name:string} };
type Lesson = { id:string;courseId:string|null; title:string; startsAt:string; endsAt:string; mode:'ONLINE'|'ONSITE'|'HYBRID'; status:string; location:string|null };
const subjects=ref<Subject[]>([]), courses=ref<Course[]>([]), teachers=ref<Teacher[]>([]), sessions=ref<Lesson[]>([]);
type Member={role:string;user:{id:string;name:string;email:string}};
const members=ref<Member[]>([]);
const enrollmentCourse=ref(''),enrollmentStudent=ref('');
const status=ref<'loading'|'ready'|'error'>('loading'), busy=ref(false), message=ref(''), error=ref('');
const subjectName=ref(''), courseTitle=ref(''), courseSubjectId=ref('');
const sessionTitle=ref(''), sessionTeacherId=ref(''), sessionCourseId=ref('');
const sessionDate=ref(''), startTime=ref('09:00'), endTime=ref('10:00');
const mode=ref<'ONLINE'|'ONSITE'|'HYBRID'>('ONLINE'), meetingUrl=ref(''), location=ref('');
async function request<T>(path:string,options?:RequestInit):Promise<T>{
  const response=await fetch(`/api/v1/workspaces/${props.workspace.id}${path}`,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options?.headers || {})}});
  if(!response.ok){ const body=await response.json().catch(()=>null); throw Error(response.status===403?'No tienes permiso para realizar esta acción.':typeof body?.message==='string'?body.message:`Error HTTP ${response.status}`); }
  return response.json() as Promise<T>;
}
async function refresh(){status.value='loading';error.value='';try{const [s,c,t,l]=await Promise.all([request<Subject[]>('/subjects'),request<Course[]>('/courses'),request<Teacher[]>('/teachers'),request<Lesson[]>('/sessions')]);subjects.value=s;courses.value=c;teachers.value=t;sessions.value=l;if(!sessionTeacherId.value)sessionTeacherId.value=t[0]?.id||'';if(['OWNER','ADMIN'].includes(props.role))members.value=await request<Member[]>('/people');else members.value=[];status.value='ready';}catch(e){error.value=e instanceof Error?e.message:'No se pudieron cargar los datos';status.value='error';}}
async function addSubject(){busy.value=true;message.value='';error.value='';try{await request('/subjects',{method:'POST',body:JSON.stringify({name:subjectName.value})});subjectName.value='';await refresh();message.value='Materia guardada correctamente.';}catch(e){error.value=e instanceof Error?e.message:'No se pudo crear la materia';}finally{busy.value=false;}}
async function addCourse(){busy.value=true;message.value='';error.value='';try{await request('/courses',{method:'POST',body:JSON.stringify({title:courseTitle.value, ...(courseSubjectId.value?{subjectId:courseSubjectId.value}:{})})});courseTitle.value='';await refresh();message.value='Curso creado.';}catch(e){error.value=e instanceof Error?e.message:'No se pudo crear el curso';}finally{busy.value=false;}}
async function addSession(){busy.value=true;message.value='';error.value='';try{
  const startsAt=new Date(`${sessionDate.value}T${startTime.value}:00`),endsAt=new Date(`${sessionDate.value}T${endTime.value}:00`);
  if(Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))throw Error('Elige una fecha y un horario válido.');
  await request('/sessions',{method:'POST',body:JSON.stringify({title:sessionTitle.value,teacherProfileId:sessionTeacherId.value,courseId:sessionCourseId.value||undefined,mode:mode.value,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),capacity:1,location:mode.value==='ONLINE'?undefined:location.value,meetingUrl:mode.value==='ONSITE'?undefined:meetingUrl.value})});sessionTitle.value='';await refresh();message.value='Clase guardada en la agenda.';
}catch(e){error.value=e instanceof Error?e.message:'No se pudo agendar la clase';}finally{busy.value=false;}}
watch(()=>props.workspace.id,async()=>{await refresh();await loadMaterials();await loadReflections();});
onMounted(async()=>{await refresh();await loadMaterials();await loadReflections();});
async function enroll(){busy.value=true;error.value='';message.value='';try{await request('/enrollments',{method:'POST',body:JSON.stringify({courseId:enrollmentCourse.value,studentUserId:enrollmentStudent.value})});message.value='Alumno inscrito correctamente.';}catch(e){error.value=e instanceof Error?e.message:'No se pudo inscribir';}finally{busy.value=false;}}
async function cancelSession(session:Lesson){
  if(!window.confirm('¿Cancelar esta clase? Se liberará el horario, pero no se enviarán avisos automáticos todavía.'))return;
  busy.value=true;error.value='';message.value='';
  try{await request('/sessions/'+session.id+'/cancel',{method:'PATCH'});await refresh();message.value='Clase cancelada correctamente.';}
  catch(e){error.value=e instanceof Error?e.message:'No se pudo cancelar la clase';}
  finally{busy.value=false;}
}
const inviteEmail=ref(''),inviteRole=ref<'TEACHER'|'STUDENT'|'ADMIN'>('TEACHER'),inviteLink=ref('');
async function invite(){busy.value=true;error.value='';inviteLink.value='';try{const r=await request<{inviteUrl:string}>('/invitations',{method:'POST',body:JSON.stringify({email:inviteEmail.value,role:inviteRole.value})});inviteLink.value=r.inviteUrl;message.value='Invitación generada. Compártela con la persona indicada.';}catch(e){error.value=e instanceof Error?e.message:'No se pudo invitar';}finally{busy.value=false;}}
async function copyInvite(){try{await navigator.clipboard.writeText(inviteLink.value);message.value='Enlace copiado.';}catch{message.value='Copia el enlace manualmente.';}}
const materialTitle=ref(''),materialUrl=ref(''),materialCourseId=ref(''),materialPublished=ref(false);
const materials=ref<Array<{id:string;title:string;url:string|null;courseId:string|null;published:boolean}>>([]);
async function loadMaterials(){
  if(!['OWNER','ADMIN'].includes(props.role))return;
  try{materials.value=await request<typeof materials.value>('/materials');}
  catch(e){error.value=e instanceof Error?e.message:'No se pudieron cargar los materiales';}
}
async function addMaterial(){
  busy.value=true;error.value='';message.value='';
  try{
    await request('/materials',{method:'POST',body:JSON.stringify({title:materialTitle.value,url:materialUrl.value,courseId:materialCourseId.value,published:materialPublished.value})});
    materialTitle.value='';materialUrl.value='';
    await loadMaterials();
    message.value='Recurso guardado correctamente.';
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo añadir el material';}
  finally{busy.value=false;}
}
type Reflection={id:string;sessionId:string;status:'DRAFT'|'REVIEW'|'PUBLISHED';notes:string};
const reflections=ref<Reflection[]>([]);
const reflectSessionId=ref(''),reflectNotes=ref('');
async function loadReflections(){
  try{reflections.value=await request<Reflection[]>('/class-alive/notes');}
  catch(e){error.value=e instanceof Error?e.message:'No se pudieron cargar las notas de Clase Viva';}
}
async function saveReflection(){
  busy.value=true;error.value='';message.value='';
  try{await request('/class-alive/sessions/'+reflectSessionId.value+'/notes',{method:'POST',body:JSON.stringify({notes:reflectNotes.value})});await loadReflections();message.value='Borrador guardado. Revísalo antes de publicarlo.';}
  catch(e){error.value=e instanceof Error?e.message:'No se pudieron guardar las notas';}
  finally{busy.value=false;}
}
async function publishReflection(){
  if(!window.confirm('¿Publicar estas notas para los alumnos inscritos en el curso?'))return;
  busy.value=true;error.value='';message.value='';
  try{await request('/class-alive/sessions/'+reflectSessionId.value+'/publish',{method:'POST'});await loadReflections();message.value='Clase Viva publicada para los alumnos inscritos.';}
  catch(e){error.value=e instanceof Error?e.message:'No se pudo publicar';}
  finally{busy.value=false;}
}
const input='mt-2 w-full rounded-xl border border-outline bg-white p-3 text-sm outline-brand';
</script>
<template>
  <main class="mx-auto max-w-6xl p-5 pb-20 md:p-9">
    <div class="mb-8 flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-bold tracking-widest text-brand">DATOS REALES · {{ workspace.type==='SOLO'?'PROFESOR':'ACADEMIA' }}</p><h1 class="mt-2 text-3xl font-extrabold">{{ workspace.name }}</h1><p class="mt-2 text-sm text-muted">Materias, cursos y clases guardados en tu espacio privado.</p></div><button class="flex items-center gap-2 rounded-xl border border-outline bg-white px-4 py-2.5 text-xs font-bold" @click="refresh"><RefreshCcw :size="16"/> Actualizar</button></div>
    <p v-if="status==='loading'" class="mb-5 rounded-xl bg-white p-5 text-sm text-muted">Cargando datos de la academia...</p>
    <div v-if="error" role="alert" class="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{{ error }} <button v-if="status==='error'" class="ml-2 underline" @click="refresh">Reintentar</button></div>
    <p v-if="message" role="status" class="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 :size="16"/>{{ message }}</p>
    <div v-if="status==='ready'" class="grid gap-5 lg:grid-cols-3">
      <section class="rounded-2xl border border-outline bg-white p-5"><div class="flex items-center gap-2"><BookOpen :size="20" class="text-brand"/><h2 class="font-extrabold">Materias</h2></div><p class="mt-2 text-xs text-muted">Organiza las áreas que enseñas.</p><form class="mt-5 flex gap-2" @submit.prevent="addSubject"><input v-model="subjectName" required minlength="2" maxlength="75" placeholder="Ej. Matemáticas" class="w-full min-w-0 rounded-xl border border-outline px-3 text-sm"/><button :disabled="busy" class="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-60" aria-label="Agregar materia"><Plus :size="20"/></button></form><div class="mt-5 space-y-2"><div v-for="subject in subjects" :key="subject.id" class="rounded-xl bg-violet-50 p-3 text-sm font-semibold text-slate-700">{{ subject.name }}</div><p v-if="!subjects.length" class="text-xs text-muted">Aún no tienes materias.</p></div></section>
      <section class="rounded-2xl border border-outline bg-white p-5"><div class="flex items-center gap-2"><GraduationCap :size="20" class="text-brand"/><h2 class="font-extrabold">Cursos</h2></div><p class="mt-2 text-xs text-muted">Puedes crear cursos para una materia o asesorías libres.</p><form class="mt-5 grid gap-3" @submit.prevent="addCourse"><input v-model="courseTitle" required minlength="3" maxlength="120" placeholder="Ej. Álgebra básica" :class="input"/><select v-model="courseSubjectId" :class="input"><option value="">Sin materia específica</option><option v-for="subject in subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option></select><button :disabled="busy" class="flex items-center justify-center gap-2 rounded-xl bg-brand p-3 text-xs font-bold text-white disabled:opacity-60"><Plus :size="16"/> Crear curso</button></form><div class="mt-5 space-y-2"><div v-for="course in courses" :key="course.id" class="rounded-xl border border-outline p-3"><p class="text-sm font-bold">{{ course.title }}</p><p class="mt-1 text-xs text-muted">{{ subjects.find(s=>s.id===course.subjectId)?.name || 'Asesoría libre' }}</p></div><p v-if="!courses.length" class="text-xs text-muted">Aún no tienes cursos.</p></div></section>
      <section class="rounded-2xl border border-outline bg-white p-5"><div class="flex items-center gap-2"><Users :size="20" class="text-brand"/><h2 class="font-extrabold">Equipo</h2></div><p class="mt-2 text-xs text-muted">Profesores asociados a este espacio.</p><div class="mt-5 space-y-3"><div v-for="teacher in teachers" :key="teacher.id" class="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span class="grid size-9 place-items-center rounded-full bg-violet-200 text-sm font-extrabold text-brand">{{ teacher.user.name[0] }}</span><div><b class="text-sm">{{ teacher.user.name }}</b><p class="text-xs text-muted">Profesor del espacio</p></div></div></div><p class="mt-5 text-xs text-muted">Invita a docentes o alumnos por correo. La persona debe entrar con ese mismo correo de Google.</p></section>
    </div>
    <section v-if="status==='ready' && ['OWNER','ADMIN'].includes(role)" class="mt-6 rounded-2xl border border-outline bg-white p-6">
      <h2 class="flex items-center gap-2 text-lg font-extrabold"><GraduationCap :size="20" class="text-brand"/> Inscribir alumnos</h2>
      <p class="mt-2 text-xs text-muted">Selecciona un alumno que ya haya aceptado su invitación y el curso que va a estudiar.</p>
      <form class="mt-4 flex flex-wrap items-end gap-3" @submit.prevent="enroll"><label class="min-w-48 flex-1 text-xs font-semibold">Alumno<select v-model="enrollmentStudent" required :class="input"><option value="">Seleccionar alumno</option><option v-for="m in members.filter(x=>x.role==='STUDENT')" :key="m.user.id" :value="m.user.id">{{ m.user.name }}</option></select></label><label class="min-w-48 flex-1 text-xs font-semibold">Curso<select v-model="enrollmentCourse" required :class="input"><option value="">Seleccionar curso</option><option v-for="course in courses" :key="course.id" :value="course.id">{{ course.title }}</option></select></label><button :disabled="busy||!courses.length" class="rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white disabled:opacity-60">Inscribir alumno</button></form>
    </section>
    <section v-if="status==='ready'" class="mt-6 rounded-2xl border border-outline bg-white p-6">
      <h2 class="flex items-center gap-2 text-lg font-extrabold"><Users :size="20" class="text-brand"/> Invitar a otra persona</h2>
      <p class="mt-2 text-xs text-muted">Genera una invitación privada de un solo uso, válida por 7 días. Compártela con su correo de Google. No se envía ningún correo automáticamente.</p>
      <form class="mt-5 flex flex-wrap items-end gap-3" @submit.prevent="invite"><label class="min-w-48 flex-1 text-xs font-semibold">Correo del invitado<input v-model="inviteEmail" required type="email" :class="input" placeholder="profesor@ejemplo.com"/></label><label class="text-xs font-semibold">Rol<select v-model="inviteRole" :class="input"><option value="TEACHER">Profesor</option><option value="STUDENT">Alumno</option><option value="ADMIN">Administrador</option></select></label><button :disabled="busy" class="rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white disabled:opacity-60">Generar invitación</button></form>
      <div v-if="inviteLink" class="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 p-4"><input :value="inviteLink" aria-label="Enlace de invitación" readonly class="min-w-0 flex-1 bg-transparent text-xs"/><button class="rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand" @click="copyInvite">Copiar enlace</button></div>
    </section>
    <section v-if="status==='ready' && ['OWNER','ADMIN'].includes(role)" class="mt-6 rounded-2xl border border-outline bg-white p-6">
      <h2 class="flex items-center gap-2 text-lg font-extrabold"><BookOpen :size="20" class="text-brand"/> Materiales de estudio</h2>
      <p class="mt-2 text-xs text-muted">Comparte un enlace HTTPS autorizado con alumnos inscritos. Drive/Dropbox se conectarán mediante OAuth más adelante.</p>
      <form class="mt-4 grid gap-3 md:grid-cols-2" @submit.prevent="addMaterial">
        <label class="text-xs font-semibold">Nombre del material<input v-model="materialTitle" required minlength="3" maxlength="140" :class="input" placeholder="Ej. Guía de ecuaciones"/></label>
        <label class="text-xs font-semibold">Enlace HTTPS<input v-model="materialUrl" required type="url" :class="input" placeholder="https://drive.google.com/file/..."/></label>
        <label class="text-xs font-semibold">Curso<select v-model="materialCourseId" required :class="input"><option value="">Selecciona un curso</option><option v-for="course in courses" :key="course.id" :value="course.id">{{ course.title }}</option></select></label>
        <label class="flex items-center gap-2 self-end text-xs font-semibold"><input v-model="materialPublished" type="checkbox" class="size-4 accent-violet-600"/> Publicar para alumnos inscritos</label>
        <button :disabled="busy || !courses.length" class="rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white disabled:opacity-60">Añadir material</button>
      </form>
      <div class="mt-5 space-y-2"><div v-for="material in materials" :key="material.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-3 text-sm"><div><p class="font-semibold">{{ material.title }}</p><p class="text-xs text-muted">{{ courses.find(c=>c.id===material.courseId)?.title || 'Curso' }}</p></div><span :class="material.published?'text-emerald-700':'text-amber-700'" class="text-xs font-bold">{{ material.published?'Publicado':'Borrador' }}</span></div></div>
    </section>
    <section v-if="status==='ready'" class="mt-6 rounded-2xl border border-outline bg-white p-6">
      <h2 class="flex items-center gap-2 text-lg font-extrabold"><GraduationCap :size="20" class="text-brand"/> Clase Viva · notas del docente</h2>
      <p class="mt-2 text-xs text-muted">Registra lo aprendido y las dificultades de la clase. Primero se guarda como borrador; luego podrás aprobarlo y publicarlo a los alumnos inscritos. La generación automática con IA está pendiente.</p>
      <form class="mt-5 grid gap-3" @submit.prevent="saveReflection">
        <label class="text-xs font-semibold">Clase asociada a un curso<select v-model="reflectSessionId" required :class="input" @change="reflectNotes=reflections.find(x=>x.sessionId===reflectSessionId)?.notes||''">
          <option value="">Selecciona una clase</option>
          <option v-for="session in sessions.filter(x=>x.courseId)" :key="session.id" :value="session.id">{{ session.title }}</option>
        </select></label>
        <label class="text-xs font-semibold">Observaciones de la clase<textarea v-model="reflectNotes" minlength="10" maxlength="12000" required rows="4" :class="input" placeholder="Hoy trabajamos... al alumno le costó... el próximo paso es..."></textarea></label>
        <div class="flex flex-wrap gap-2"><button :disabled="busy||!reflectSessionId||reflections.some(x=>x.sessionId===reflectSessionId&&x.status==='PUBLISHED')" class="rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white disabled:opacity-40">Guardar borrador</button>
        <button v-if="reflections.some(x=>x.sessionId===reflectSessionId&&x.status!=='PUBLISHED')" type="button" :disabled="busy" class="rounded-xl border border-emerald-300 px-5 py-3 text-xs font-bold text-emerald-700 disabled:opacity-40" @click="publishReflection">Aprobar y publicar</button></div>
      </form>
      <div class="mt-5 space-y-2"><div v-for="item in reflections" :key="item.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline p-3"><span class="text-sm font-semibold">{{ sessions.find(x=>x.id===item.sessionId)?.title||'Clase' }}</span><span class="text-xs font-semibold" :class="item.status==='PUBLISHED'?'text-emerald-700':'text-amber-700'">{{ item.status==='PUBLISHED'?'Publicado':'Borrador' }}</span></div></div>
    </section>
    <section v-if="status==='ready'" class="mt-6 rounded-2xl border border-outline bg-white p-6"><div class="flex items-center gap-2"><CalendarDays :size="21" class="text-brand"/><h2 class="text-lg font-extrabold">Agenda real</h2></div><p class="mt-2 text-xs text-muted">Clases presenciales, virtuales o híbridas. Hasta conectar Google/Zoom, pega un enlace HTTPS creado en tu plataforma de videollamadas.</p><form class="mt-6 grid gap-4 md:grid-cols-3" @submit.prevent="addSession"><label class="text-xs font-semibold">Título<input v-model="sessionTitle" required minlength="3" placeholder="Ej. Clase de refuerzo" :class="input"/></label><label class="text-xs font-semibold">Profesor<select v-model="sessionTeacherId" required :class="input"><option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{ teacher.user.name }}</option></select></label><label class="text-xs font-semibold">Curso<select v-model="sessionCourseId" :class="input"><option value="">Sin curso asociado</option><option v-for="course in courses" :key="course.id" :value="course.id">{{ course.title }}</option></select></label><label class="text-xs font-semibold">Fecha<input v-model="sessionDate" required type="date" :class="input"/></label><label class="text-xs font-semibold">Desde<input v-model="startTime" required type="time" :class="input"/></label><label class="text-xs font-semibold">Hasta<input v-model="endTime" required type="time" :class="input"/></label><label class="text-xs font-semibold">Modalidad<select v-model="mode" :class="input"><option value="ONLINE">Virtual</option><option value="ONSITE">Presencial</option><option value="HYBRID">Híbrida</option></select></label><label v-if="mode!=='ONSITE'" class="text-xs font-semibold"><span class="flex gap-1"><Video :size="13"/> Enlace HTTPS</span><input v-model="meetingUrl" required type="url" placeholder="https://meet.google.com/..." :class="input"/></label><label v-if="mode!=='ONLINE'" class="text-xs font-semibold"><span class="flex gap-1"><MapPin :size="13"/> Dirección o sede</span><input v-model="location" required placeholder="Sede Centro, Aula 2" :class="input"/></label><div class="flex items-end"><button :disabled="busy||!teachers.length" class="w-full rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white disabled:opacity-60">{{ busy?'Guardando...':'Agendar clase' }}</button></div></form>
      <div class="mt-7 divide-y divide-outline"><div v-for="session in sessions" :key="session.id" class="flex flex-wrap items-center justify-between gap-3 py-4"><div><p class="text-sm font-bold">{{ session.title }}</p><p class="mt-1 text-xs text-muted">{{ new Date(session.startsAt).toLocaleString('es-CO') }} · {{ session.mode==='ONLINE'?'Virtual':session.mode==='ONSITE'?'Presencial':'Híbrida' }}</p></div><div class="flex items-center gap-3"><span class="rounded-full px-3 py-1 text-xs font-bold" :class="session.status==='CANCELLED'?'bg-slate-100 text-slate-600':'bg-emerald-50 text-emerald-700'">{{ session.status }}</span><button v-if="session.status==='CONFIRMED'" :disabled="busy" class="rounded-lg border border-rose-200 px-3 py-1 text-xs font-bold text-rose-600 disabled:opacity-40" @click="cancelSession(session)">Cancelar</button></div></div><p v-if="!sessions.length" class="py-5 text-sm text-muted">Todavía no hay clases programadas.</p></div>
    </section>
  <PracticeTeacher v-if="status==='ready'" :workspace-id="workspace.id" :sessions="sessions" />
    <StudioEditor v-if="status==='ready' && ['OWNER','ADMIN'].includes(role)" :workspace="workspace" :courses="courses" />
    <StaffAttendance v-if="status==='ready'" :workspace-id="workspace.id" />
    <FinanceLedger v-if="status==='ready' && ['OWNER','ADMIN'].includes(role)" :workspace-id="workspace.id" :role="role" :students="members" :courses="courses" />
  </main>
</template>
