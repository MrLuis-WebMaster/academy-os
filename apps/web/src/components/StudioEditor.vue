<script setup lang="ts">
import {apiJson} from '../shared/api-client';
import {computed,onMounted,ref,watch} from 'vue';
import {ArrowUpRight,Store,Plus} from 'lucide-vue-next';
import {UiAlert,UiButton,UiField,UiInput,UiSelect,UiSwitch,UiTextarea} from '@academy-os/ui';

const props=defineProps<{
  workspace:{id:string;name:string;slug?:string};
  courses:Array<{id:string;title:string}>;
}>();
type Settings={
  id:string;name:string;slug:string;description:string|null;
  contactUrl:string|null;publicEnabled:boolean;
};
type Offering={
  id:string;title:string;description:string|null;priceCOP:number;
  durationMinutes:number;mode:string;published:boolean;courseId:string|null;
};
const settings=ref<Settings|null>(null),offerings=ref<Offering[]>([]);
const loading=ref(true),busy=ref(false),error=ref(''),message=ref('');
const description=ref(''),contactUrl=ref(''),publicEnabled=ref(false);
const title=ref(''),details=ref(''),priceCOP=ref(45000),duration=ref(60);
const mode=ref<'ONLINE'|'ONSITE'|'HYBRID'>('ONLINE'),courseId=ref('');
let loadVersion=0,mutationVersion=0;

function publicUrl(slug:string){
  return window.location.origin+'/?academy='+encodeURIComponent(slug);
}
const studioUrl=computed(()=>publicUrl(settings.value?.slug||props.workspace.slug||''));
function apiFor<T>(workspaceId:string,suffix:string,method='GET',body?:unknown){
  return apiJson<T>(
    '/api/v1/studio/workspaces/'+encodeURIComponent(workspaceId)+suffix,method,body,
  );
}
async function refresh(){
  const version=++loadVersion;
  const workspaceId=props.workspace.id;
  loading.value=true;
  error.value='';
  // Never show the previous academy's catalog while the new one is loading.
  settings.value=null;
  offerings.value=[];
  try{
    const [config,list]=await Promise.all([
      apiFor<Settings>(workspaceId,''),
      apiFor<Offering[]>(workspaceId,'/offerings'),
    ]);
    if(version!==loadVersion||workspaceId!==props.workspace.id)return;
    settings.value=config;
    offerings.value=list;
    description.value=config.description||'';
    contactUrl.value=config.contactUrl||'';
    publicEnabled.value=config.publicEnabled;
  }catch(e){
    if(version===loadVersion&&workspaceId===props.workspace.id){
      error.value=e instanceof Error?e.message:'No se pudo cargar Profe Studio';
    }
  }finally{
    if(version===loadVersion)loading.value=false;
  }
}
async function save(){
  if(busy.value)return;
  const workspaceId=props.workspace.id,operation=++mutationVersion;
  busy.value=true;error.value='';message.value='';
  try{
    await apiFor(workspaceId,'','PATCH',{
      description:description.value,contactUrl:contactUrl.value,
      publicEnabled:publicEnabled.value,
    });
    if(workspaceId!==props.workspace.id)return;
    await refresh();
    if(workspaceId===props.workspace.id)message.value='Configuración del catálogo guardada.';
  }catch(e){
    if(workspaceId===props.workspace.id){
      error.value=e instanceof Error?e.message:'No se pudo guardar';
    }
  }finally{
    if(operation===mutationVersion)busy.value=false;
  }
}
async function add(){
  if(busy.value)return;
  const workspaceId=props.workspace.id,operation=++mutationVersion;
  busy.value=true;error.value='';message.value='';
  try{
    await apiFor(workspaceId,'/offerings','POST',{
      title:title.value,description:details.value,
      priceCOP:priceCOP.value,durationMinutes:duration.value,mode:mode.value,
      ...(courseId.value?{courseId:courseId.value}:{}),
    });
    if(workspaceId!==props.workspace.id)return;
    title.value='';details.value='';
    await refresh();
    if(workspaceId===props.workspace.id)message.value='Servicio guardado como borrador.';
  }catch(e){
    if(workspaceId===props.workspace.id){
      error.value=e instanceof Error?e.message:'No se pudo crear el servicio';
    }
  }finally{
    if(operation===mutationVersion)busy.value=false;
  }
}
async function toggle(offer:Offering){
  if(busy.value)return;
  const workspaceId=props.workspace.id,operation=++mutationVersion;
  busy.value=true;error.value='';message.value='';
  try{
    await apiFor(workspaceId,'/offerings/'+encodeURIComponent(offer.id),'PATCH',{
      published:!offer.published,
    });
    if(workspaceId!==props.workspace.id)return;
    await refresh();
    if(workspaceId===props.workspace.id){
      message.value=offer.published?'Servicio ocultado.':'Servicio publicado.';
    }
  }catch(e){
    if(workspaceId===props.workspace.id){
      error.value=e instanceof Error?e.message:'No se pudo actualizar el servicio';
    }
  }finally{
    if(operation===mutationVersion)busy.value=false;
  }
}
watch(()=>props.workspace.id,()=>{
  ++loadVersion;
  ++mutationVersion;
  busy.value=false;error.value='';message.value='';
  settings.value=null;offerings.value=[];
  title.value='';details.value='';courseId.value='';
  description.value='';contactUrl.value='';publicEnabled.value=false;
  void refresh();
});
onMounted(()=>void refresh());
</script>
<template>
<section class="mt-6 rounded-2xl border border-outline bg-surface p-6">
 <div class="flex items-center gap-2"><Store :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Profe Studio · Catálogo público</h2><p class="mt-1 text-xs text-muted">Publica clases y servicios con tu propia identidad; puedes ocultar toda la página hasta tenerla lista.</p></div></div>
 <p v-if="loading" class="mt-5 text-xs text-muted">Cargando Profe Studio...</p>
 <div v-else-if="settings" class="mt-5 space-y-6">
  <form class="grid gap-3 md:grid-cols-2" @submit.prevent="save">
   <div class="md:col-span-2"><UiField for="studio-description" label="Presentación"><UiTextarea id="studio-description" v-model="description" :maxlength="800" :rows="2" placeholder="¿Qué hace única a tu academia?"/></UiField></div>
   <UiField for="studio-contact" label="URL de contacto HTTPS"><UiInput id="studio-contact" v-model="contactUrl" type="url" placeholder="https://wa.me/573001234567"/></UiField>
   <div class="self-end"><UiSwitch v-model="publicEnabled" label="Catálogo públicamente visible" /></div>
   <div class="flex flex-wrap items-center gap-3 md:col-span-2"><UiButton type="submit" :loading="busy">Guardar presentación</UiButton><a :href="studioUrl" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-xs font-bold text-brand">Ver mi página <ArrowUpRight :size="14"/></a></div>
  </form>
  <div class="border-t border-outline pt-5"><h3 class="text-base font-extrabold">Servicios disponibles</h3><p class="mt-2 text-xs text-muted">Los servicios nuevos permanecen privados hasta que los publiques.</p>
   <form class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="add">
    <UiField for="offering-title" label="Nombre" required><UiInput id="offering-title" v-model="title" required :minlength="3" :maxlength="120" placeholder="Ej. Clase personalizada de inglés"/></UiField>
    <UiField for="offering-course" label="Curso relacionado"><UiSelect id="offering-course" v-model="courseId"><option value="">Servicio independiente</option><option v-for="course in courses" :key="course.id" :value="course.id">{{ course.title }}</option></UiSelect></UiField>
    <div class="sm:col-span-2"><UiField for="offering-details" label="Descripción"><UiInput id="offering-details" v-model="details" :maxlength="700" placeholder="Incluye materiales y acompañamiento"/></UiField></div>
    <label class="text-xs font-semibold">Precio en COP<input v-model.number="priceCOP" type="number" min="0" max="100000000" required class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"/></label>
    <label class="text-xs font-semibold">Duración (min)<input v-model.number="duration" type="number" min="15" max="480" required class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"/></label>
    <label class="text-xs font-semibold">Modalidad<select v-model="mode" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"><option value="ONLINE">Virtual</option><option value="ONSITE">Presencial</option><option value="HYBRID">Híbrida</option></select></label>
    <UiButton type="submit" class="self-end" :loading="busy"><Plus :size="15"/> Crear servicio</UiButton>
   </form>
  </div>
  <div class="grid gap-2 md:grid-cols-2">
   <div v-for="offer in offerings" :key="offer.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-3">
    <div><p class="text-sm font-bold">{{ offer.title }}</p><p class="mt-1 text-xs text-muted">{{ new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(offer.priceCOP) }} · {{ offer.durationMinutes }} minutos</p></div>
    <button :disabled="busy" @click="toggle(offer)" class="rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" :class="offer.published?'bg-warning-soft text-warning':'bg-success-soft text-success'">{{ offer.published?'Ocultar':'Publicar' }}</button>
   </div>
   <p v-if="!offerings.length" class="text-xs text-muted">Aún no has creado servicios.</p>
  </div>
 </div>
 <UiAlert v-if="error" tone="danger" class="mt-4">{{ error }}</UiAlert>
 <UiAlert v-if="message" tone="success" class="mt-4">{{ message }}</UiAlert>
</section>
</template>
