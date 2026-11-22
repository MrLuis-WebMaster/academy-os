<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { UiBadge, UiButton, UiField, UiInput, UiThemeSwitcher, UiBrand } from '@academy-os/ui';
import { ArrowLeft, ArrowRight, BookOpen, Check, GraduationCap, School, ShieldCheck, Sparkles, UserRound, LoaderCircle } from 'lucide-vue-next';
import { authClient } from '../auth-client';
import App from '../App.vue';
import OperationsPanel from './OperationsPanel.vue';
import StudentClassroom from './StudentClassroom.vue';
import NotificationCenter from './NotificationCenter.vue';

type Workspace = { id: string; name: string; slug: string; type: 'SOLO'|'ACADEMY'; brandColor: string };
type Membership = { role: string; workspace: Workspace };
type Identity = { id: string; name: string; email: string };
const state = ref<'loading'|'login'|'setup'|'ready'|'error'>('loading');
const googleConfigured = ref(false);
const user = ref<Identity | null>(null);
const memberships = ref<Membership[]>([]);
const selected = ref<Workspace | null>(null);
const demo = ref(false);
const operations = ref(true);
const pendingInvite = ref('');
const busy = ref(false);
const error = ref('');
const step = ref(1);
const type = ref<'SOLO'|'ACADEMY'>('SOLO');
const name = ref('');
const timezone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota');
const choices = ['Inglés','Matemáticas','Programación','Física','Música','Arte','Idiomas','Refuerzo escolar'];
const subjects = ref<string[]>([]);
const requestId = ref(crypto.randomUUID());
const currentRole = computed(() => { const roles=memberships.value.filter(m=>m.workspace.id===selected.value?.id).map(m=>m.role);return ['OWNER','ADMIN','TEACHER','STUDENT','GUARDIAN'].find(role=>roles.includes(role)) || 'STUDENT';});
const initials = computed(() => (user.value?.name || 'Mi academia').split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase());
watch(() => selected.value?.brandColor, color => {
  const root=document.documentElement;
  if (color && /^#[0-9a-f]{6}$/i.test(color)) root.style.setProperty('--ao-brand-override',color);
  else root.style.removeProperty('--ao-brand-override');
}, {immediate:true});

async function load() {
  state.value = 'loading';
  error.value = '';
  try {
    const config = await fetch('/api/v1/auth-config');
    if (!config.ok) throw new Error('El servidor no está disponible.');
    googleConfigured.value = Boolean((await config.json()).googleConfigured);
    const result = await fetch('/api/v1/me', { credentials: 'same-origin' });
    if (result.status === 401) { state.value = 'login'; return; }
    if (!result.ok) throw new Error('No se pudo comprobar tu sesión.');
    let body = await result.json() as {user: Identity; memberships: Membership[]};
    const invite = pendingInvite.value || sessionStorage.getItem('academy:invite') || '';
    if(invite){
      const acceptance=await fetch('/api/v1/invitations/accept',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({token:invite})});
      if(!acceptance.ok){const detail=await acceptance.json().catch(()=>null);throw Error(detail?.message || 'No se pudo aceptar esta invitación. Comprueba que usas el correo correcto.');}
      sessionStorage.removeItem('academy:invite');pendingInvite.value='';
      const refreshed=await fetch('/api/v1/me',{credentials:'same-origin'});
      if(!refreshed.ok)throw Error('No se pudo actualizar tu acceso.');
      body=await refreshed.json() as {user:Identity;memberships:Membership[]};
    }
    user.value = body.user; memberships.value = body.memberships;
    if (!memberships.value.length) {
      name.value = `Academia de ${body.user.name.split(' ')[0]}`;
      state.value = 'setup';
      return;
    }
    selected.value = memberships.value[0]?.workspace || null;
    state.value = 'ready';
  } catch (e) { error.value = e instanceof Error ? e.message : 'Algo salió mal.'; state.value='error'; }
}
async function signIn() {
  busy.value = true; error.value='';
  try { const { error: authError } = await authClient.signIn.social({ provider:'google', callbackURL: window.location.origin }); if(authError) throw Error(authError.message || 'Error de acceso'); }
  catch (e) { error.value = e instanceof Error ? e.message : 'No pudimos iniciar sesión.'; }
  finally { busy.value = false; }
}
function newWorkspace(){state.value='setup';step.value=1;name.value=`Academia de ${user.value?.name.split(' ')[0] || 'Mi nombre'}`;type.value='SOLO';subjects.value=[];requestId.value=crypto.randomUUID();error.value='';}
async function signOut() { await authClient.signOut(); user.value=null; memberships.value=[]; selected.value=null; state.value='login'; demo.value=false; }
async function create() {
  busy.value=true; error.value='';
  try {
    const response=await fetch('/api/v1/workspaces', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ requestId:requestId.value, type:type.value, name:name.value.trim(), timezone:timezone.value, subjects:subjects.value }) });
    if(!response.ok) { const body=await response.json().catch(()=>null); throw Error(response.status===409?'Este nombre ya está ocupado. Prueba con otro.':body?.message || 'No pudimos crear el espacio.'); }
    const workspace=await response.json() as Workspace;
    selected.value=workspace;
    memberships.value.push({ role:'OWNER', workspace });
    state.value='ready';
  } catch(e){error.value=e instanceof Error?e.message:'Error al crear la academia';}
  finally{busy.value=false;}
}
function next() { error.value=''; if(step.value===2 && name.value.trim().length<2){error.value='Elige un nombre para continuar.';return;} if(step.value<3) step.value++; else void create(); }
function toggleSubject(s:string) { subjects.value=subjects.value.includes(s)?subjects.value.filter(x=>x!==s):[...subjects.value,s]; }
onMounted(()=>{
  const url = new URL(window.location.href);
  const invite = url.searchParams.get('invite');
  if(invite && /^[a-zA-Z0-9_-]{40,100}$/.test(invite)){
    pendingInvite.value=invite;
    sessionStorage.setItem('academy:invite',invite);
    url.searchParams.delete('invite');
    window.history.replaceState({},'',url.pathname+url.search+url.hash);
  }
  void load();
});
</script>

<template>
  <div v-if="state==='loading'" class="grid min-h-screen place-items-center bg-canvas"><span class="flex items-center gap-2 text-sm text-brand"><LoaderCircle class="animate-spin" :size="20"/> Preparando tu espacio...</span></div>
  <template v-else-if="state==='ready' || demo">
    <div class="min-h-screen">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-outline bg-surface px-4 py-2 text-xs md:px-8">
        <div class="flex flex-wrap items-center gap-2"><span class="font-extrabold text-brand">AcademyOS</span><span v-if="demo" class="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Vista de demostración · sin datos reales</span><span v-else class="rounded-full bg-emerald-100 px-2 py-1 text-success">Sesión iniciada · {{ selected?.name }}</span></div>
        <div class="flex items-center gap-2">
          <NotificationCenter v-if="!demo && selected" :workspace-id="selected.id" />
          <UiThemeSwitcher />
          <select v-if="!demo && memberships.length>1" aria-label="Elegir academia" class="rounded-lg border border-outline px-2 py-1 text-xs" :value="selected?.id" @change="selected=memberships.find(m=>m.workspace.id===($event.target as HTMLSelectElement).value)?.workspace || null"><option v-for="m in memberships" :key="m.workspace.id" :value="m.workspace.id">{{ m.workspace.name }}</option></select>
          <button v-if="!demo" class="rounded-lg border border-outline px-3 py-2 font-bold text-muted" @click="newWorkspace">Nueva academia</button>
          <button v-if="!demo" class="rounded-lg border border-outline px-3 py-2 font-bold text-muted" @click="operations=!operations">{{ operations ? 'Ver prototipo' : 'Gestión real' }}</button>
          <button class="rounded-lg border border-outline px-3 py-2 font-bold text-muted" @click="demo ? (demo=false,state='login') : signOut()">{{ demo ? 'Salir de la demo' : 'Cerrar sesión' }}</button>
        </div>
      </div>
      <OperationsPanel v-if="!demo && operations && selected && ['OWNER','ADMIN','TEACHER'].includes(currentRole)" :workspace="selected" :role="currentRole" />
      <StudentClassroom v-else-if="!demo && operations && selected" :workspace="selected" />
      <App v-else :active-workspace="selected" :viewer-name="user?.name || 'Demo'" />
    </div>
  </template>
  <div v-else class="flex min-h-screen items-center justify-center bg-gradient-to-br from-canvas via-surface to-surface-muted p-5">
    <main class="w-full max-w-xl rounded-3xl border border-outline bg-surface p-7 shadow-xl shadow-violet-100/70 sm:p-10">
      <div class="mb-8 flex items-center justify-between gap-3"><UiBrand /><UiThemeSwitcher /></div>
      <template v-if="state==='login'">
        <span class="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand"><Sparkles :size="14"/> Tu enseñanza, en un solo lugar</span>
        <h1 class="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Bienvenido a una nueva forma de enseñar.</h1>
        <p class="mt-4 text-sm leading-7 text-muted">Organiza tus clases, acompaña a tus alumnos y crea tu propio espacio educativo. Sin contraseñas ni formularios largos.</p>
        <UiButton variant="secondary" size="lg" class="mt-8" block :loading="busy" :disabled="!googleConfigured" @click="signIn"><span class="text-xl font-black text-[#4285F4]">G</span>Continuar con Google</UiButton>
        <p v-if="!googleConfigured" class="mt-3 text-center text-xs text-warning">El administrador debe configurar Google OAuth en el servidor para habilitar el acceso.</p>
        <p class="mt-6 text-center text-xs text-muted">¿Solo quieres explorar? <button class="font-bold text-brand underline" @click="demo=true">Ver una demostración</button></p>
      </template>
      <template v-else-if="state==='setup'">
        <div class="mb-6 flex justify-between text-xs font-bold text-brand"><span>Configura tu espacio</span><span>Paso {{ step }} de 3</span></div>
        <div class="mb-8 grid grid-cols-3 gap-2"><div v-for="i in 3" :key="i" :class="i<=step?'bg-brand':'bg-brand-soft'" class="h-1.5 rounded-full"></div></div>
        <template v-if="step===1">
          <h1 class="text-2xl font-extrabold">¿Qué vas a crear?</h1><p class="mt-3 text-sm text-muted">Puedes cambiar detalles y añadir profesores más adelante.</p>
          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" :aria-pressed="type==='SOLO'" :class="type==='SOLO'?'border-brand bg-brand-soft':'border-outline'" class="rounded-2xl border-2 p-5 text-left" @click="type='SOLO'"><UserRound :size="23" class="text-brand"/><b class="mt-3 block">Soy profesor</b><span class="mt-2 block text-xs leading-5 text-muted">Mis clases, materias y alumnos particulares.</span></button>
            <button type="button" :aria-pressed="type==='ACADEMY'" :class="type==='ACADEMY'?'border-brand bg-brand-soft':'border-outline'" class="rounded-2xl border-2 p-5 text-left" @click="type='ACADEMY'"><School :size="23" class="text-brand"/><b class="mt-3 block">Tengo una academia</b><span class="mt-2 block text-xs leading-5 text-muted">Varios profesores, materias y grupos.</span></button>
          </div>
        </template>
        <template v-else-if="step===2">
          <h1 class="text-2xl font-extrabold">¿Cómo se llama tu espacio?</h1><p class="mt-3 text-sm text-muted">Este será el nombre que verán tus alumnos.</p>
          <div class="mt-7"><UiField label="Nombre de tu academia" for="academy-name" required><UiInput id="academy-name" v-model="name" autocomplete="organization" :maxlength="80" placeholder="Ej. Academia de Laura" @keyup.enter="next"/></UiField></div>
          <div class="mt-5 flex items-center gap-3 rounded-xl bg-surface-muted p-3"><div class="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-extrabold text-brand">{{ initials }}</div><p class="text-xs text-muted">Tu cuenta de Google será la propietaria de este espacio. No necesitas crear otro usuario administrador.</p></div>
        </template>
        <template v-else>
          <h1 class="text-2xl font-extrabold">Personaliza tu enseñanza</h1><p class="mt-3 text-sm text-muted">Opcional. Puedes agregar las materias ahora o hacerlo después.</p>
          <div class="mt-6 flex flex-wrap gap-2"><button v-for="s in choices" :key="s" type="button" :aria-pressed="subjects.includes(s)" :class="subjects.includes(s)?'border-brand bg-brand-soft text-brand':'border-outline text-muted'" class="rounded-full border px-4 py-2 text-xs font-bold" @click="toggleSubject(s)">{{ subjects.includes(s)?'✓ ':'' }}{{ s }}</button></div>
          <div class="mt-6 flex items-center gap-3 rounded-xl bg-success-soft p-4 text-xs text-success"><ShieldCheck :size="21"/> Todo listo: {{ name }} tendrá su propio espacio y permisos independientes.</div>
        </template>
        <p v-if="error" role="alert" class="mt-4 rounded-xl bg-danger-soft p-3 text-xs font-medium text-danger">{{ error }}</p>
        <div class="mt-8 flex items-center justify-between gap-3"><button v-if="step>1" class="flex items-center gap-2 text-xs font-bold text-muted" @click="step--"><ArrowLeft :size="15"/> Volver</button><span v-else></span><UiButton :loading="busy" @click="next">{{ step===3?'Crear mi espacio':'Continuar' }}<Check v-if="step===3" :size="15"/><ArrowRight v-else :size="15"/></UiButton></div>
      </template>
      <template v-else><h1 class="text-xl font-extrabold">No pudimos iniciar AcademyOS</h1><p class="mt-4 text-sm text-muted">{{ error }}</p><UiButton class="mt-5" @click="load">Reintentar</UiButton></template>
      <p v-if="error && state==='login'" role="alert" class="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">{{ error }}</p>
      <div class="mt-9 flex items-center gap-2 border-t border-outline pt-5 text-xs text-muted"><BookOpen :size="15"/> AcademyOS · Acceso seguro</div>
    </main>
  </div>
</template>
