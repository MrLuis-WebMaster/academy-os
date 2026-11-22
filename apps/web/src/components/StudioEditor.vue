<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {ArrowUpRight,CheckCircle2,Store,Plus} from 'lucide-vue-next';
const props=defineProps<{workspace:{id:string;name:string;slug?:string};courses:Array<{id:string;title:string}>}>();
type Settings={id:string;name:string;slug:string;description:string|null;contactUrl:string|null;publicEnabled:boolean};
type Offering={id:string;title:string;description:string|null;priceCOP:number;durationMinutes:number;mode:string;published:boolean;courseId:string|null};
const settings=ref<Settings|null>(null),offerings=ref<Offering[]>([]),loading=ref(true),busy=ref(false),error=ref(''),message=ref('');
const description=ref(''),contactUrl=ref(''),publicEnabled=ref(false);
const title=ref(''),details=ref(''),priceCOP=ref(45000),duration=ref(60),mode=ref<'ONLINE'|'ONSITE'|'HYBRID'>('ONLINE'),courseId=ref('');
function publicUrl(slug:string){return window.location.origin+'/?academy='+encodeURIComponent(slug);}
async function api<T>(suffix:string,method='GET',body?:unknown){
 const response=await fetch('/api/v1/studio/workspaces/'+props.workspace.id+suffix,{
   method,credentials:'same-origin',
   ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})
 });
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data&&typeof data==='object'&&'message' in data&&typeof data.message==='string'?data.message:'Error al guardar el catálogo.');
 return data as T;
}
async function refresh(){
 loading.value=true;error.value='';
 try{
  const [cfg,list]=await Promise.all([api<Settings>(''),api<Offering[]>('/offerings')]);
  settings.value=cfg;offerings.value=list;description.value=cfg.description||'';contactUrl.value=cfg.contactUrl||'';publicEnabled.value=cfg.publicEnabled;
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo cargar Profe Studio';}
 finally{loading.value=false;}
}
async function save(){
 busy.value=true;error.value='';message.value='';
 try{await api('', 'PATCH',{description:description.value,contactUrl:contactUrl.value,publicEnabled:publicEnabled.value});await refresh();message.value='Configuración del catálogo guardada.';}
 catch(e){error.value=e instanceof Error?e.message:'No se pudo guardar';}
 finally{busy.value=false;}
}
async function add(){
 busy.value=true;error.value='';message.value='';
 try{
  await api('/offerings','POST',{title:title.value,description:details.value,priceCOP:priceCOP.value,durationMinutes:duration.value,mode:mode.value,...(courseId.value?{courseId:courseId.value}:{})});
  title.value='';details.value='';await refresh();message.value='Servicio guardado como borrador.';
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo crear el servicio';}
 finally{busy.value=false;}
}
async function toggle(offer:Offering){
 busy.value=true;error.value='';message.value='';
 try{await api('/offerings/'+offer.id,'PATCH',{published:!offer.published});await refresh();message.value=offer.published?'Servicio ocultado.':'Servicio publicado.';}
 catch(e){error.value=e instanceof Error?e.message:'No se pudo actualizar el servicio';}
 finally{busy.value=false;}
}
watch(()=>props.workspace.id,refresh);
onMounted(refresh);
</script>
<template>
<section class="mt-6 rounded-2xl border border-outline bg-surface p-6">
 <div class="flex items-center gap-2"><Store :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Profe Studio · Catálogo público</h2><p class="mt-1 text-xs text-muted">Publica clases y servicios con tu propia identidad; puedes ocultar toda la página hasta tenerla lista.</p></div></div>
 <p v-if="loading" class="mt-5 text-xs text-muted">Cargando Profe Studio...</p>
 <div v-else-if="settings" class="mt-5 space-y-6">
  <form class="grid gap-3 md:grid-cols-2" @submit.prevent="save">
   <label class="text-xs font-semibold md:col-span-2">Presentación<textarea v-model="description" maxlength="800" rows="2" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm" placeholder="¿Qué hace única a tu academia?"></textarea></label>
   <label class="text-xs font-semibold">URL de contacto HTTPS<input v-model="contactUrl" type="url" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm" placeholder="https://wa.me/573001234567"/></label>
   <label class="flex items-center gap-2 self-end text-xs font-semibold"><input v-model="publicEnabled" type="checkbox" class="size-4 accent-violet-600"/> Catálogo públicamente visible</label>
   <div class="flex flex-wrap items-center gap-3 md:col-span-2"><button :disabled="busy" class="rounded-xl bg-brand px-5 py-3 text-xs font-extrabold text-white disabled:opacity-50">Guardar presentación</button><a :href="publicUrl(settings.slug)" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-xs font-bold text-brand">Ver mi página <ArrowUpRight :size="14"/></a></div>
  </form>
  <div class="border-t border-outline pt-5"><h3 class="text-base font-extrabold">Servicios disponibles</h3><p class="mt-2 text-xs text-muted">Los servicios nuevos permanecen privados hasta que los publiques.</p>
   <form class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="add">
    <label class="text-xs font-semibold">Nombre<input v-model="title" required minlength="3" maxlength="120" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm" placeholder="Ej. Clase personalizada de inglés"/></label>
    <label class="text-xs font-semibold">Curso relacionado<select v-model="courseId" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"><option value="">Servicio independiente</option><option v-for="course in courses" :key="course.id" :value="course.id">{{ course.title }}</option></select></label>
    <label class="text-xs font-semibold sm:col-span-2">Descripción<input v-model="details" maxlength="700" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm" placeholder="Incluye materiales y acompañamiento"/></label>
    <label class="text-xs font-semibold">Precio en COP<input v-model.number="priceCOP" type="number" min="0" max="100000000" required class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"/></label>
    <label class="text-xs font-semibold">Duración (min)<input v-model.number="duration" type="number" min="15" max="480" required class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"/></label>
    <label class="text-xs font-semibold">Modalidad<select v-model="mode" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"><option value="ONLINE">Virtual</option><option value="ONSITE">Presencial</option><option value="HYBRID">Híbrida</option></select></label>
    <button :disabled="busy" class="flex items-center justify-center gap-2 self-end rounded-xl bg-brand px-5 py-3 text-xs font-bold text-white disabled:opacity-50"><Plus :size="15"/> Crear servicio</button>
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
 <p v-if="error" role="alert" class="mt-4 rounded-xl bg-danger-soft p-3 text-xs text-danger">{{ error }}</p>
 <p v-if="message" role="status" class="mt-4 flex items-center gap-2 rounded-xl bg-success-soft p-3 text-xs text-success"><CheckCircle2 :size="14"/>{{ message }}</p>
</section>
</template>
