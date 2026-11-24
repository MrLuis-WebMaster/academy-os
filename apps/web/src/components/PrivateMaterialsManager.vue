<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {Download,FileUp,RefreshCw,Trash2} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,apiRequest,workspacePath} from '../shared/api-client';

type Row={id:string;title:string;courseId:string|null;filename:string;mimeType:string;sizeBytes:number;published:boolean;createdAt:string};
const props=defineProps<{workspaceId:string;courses:{id:string;title:string}[]}>();
const files=ref<Row[]>([]),loading=ref(true),busy=ref(false),enabled=ref(false),error=ref(''),notice=ref('');
const title=ref(''),courseId=ref(''),file=ref<File|null>(null),fileInput=ref<HTMLInputElement|null>(null);
let version=0;
const path=(workspace:string,suffix='')=>workspacePath(workspace,'/material-files'+suffix);
const rowPath=(id:string)=>'/'+encodeURIComponent(id);
function choose(event:Event){
 const selected=(event.target as HTMLInputElement).files?.[0]??null;
 error.value='';file.value=null;
 if(!selected)return;
 if(selected.size>5*1024*1024||!['application/pdf','image/png','image/jpeg'].includes(selected.type)){
  error.value='El archivo debe ser PDF, PNG o JPEG y pesar hasta 5 MiB.';
  if(fileInput.value)fileInput.value.value='';
  return;
 }
 file.value=selected;
}
async function load(){
 const workspace=props.workspaceId,n=++version;
 loading.value=true;files.value=[];enabled.value=false;error.value='';
 try{
  const result=await apiJson<{uploadsEnabled:boolean;files:Row[]}>(path(workspace));
  if(n===version&&workspace===props.workspaceId){files.value=result.files;enabled.value=result.uploadsEnabled;}
 }catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudieron consultar los archivos.';}
 finally{if(n===version)loading.value=false;}
}
async function upload(){
 if(!file.value||!courseId.value||!enabled.value||busy.value)return;
 const workspace=props.workspaceId;
 busy.value=true;error.value='';notice.value='';
 const form=new FormData();
 form.append('courseId',courseId.value);form.append('title',title.value);form.append('file',file.value);
 try{
  await apiRequest(path(workspace),{method:'POST',body:form});
  if(workspace!==props.workspaceId)return;
  title.value='';file.value=null;if(fileInput.value)fileInput.value.value='';
  await load();if(workspace===props.workspaceId)notice.value='Archivo guardado como borrador. Revísalo antes de publicarlo.';
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo guardar el archivo.';}
 finally{busy.value=false;}
}
async function publication(row:Row){
 if(busy.value||(!row.published&&!enabled.value))return;
 if(!window.confirm(row.published?'¿Retirar este material para los estudiantes?':'¿Confirmas que has revisado este archivo y tienes permiso para compartirlo con los alumnos matriculados?'))return;
 const workspace=props.workspaceId;busy.value=true;error.value='';notice.value='';
 try{
  await apiJson(path(workspace,rowPath(row.id)+'/publication'),'PATCH',{published:!row.published});
  if(workspace!==props.workspaceId)return;
  await load();if(workspace===props.workspaceId)notice.value=row.published?'Material retirado.':'Material publicado.';
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo modificar la publicación.';}
 finally{busy.value=false;}
}
async function remove(row:Row){
 if(busy.value||!window.confirm('¿Eliminar definitivamente este archivo de AcademyOS? Las copias descargadas anteriormente no se eliminan.'))return;
 const workspace=props.workspaceId;busy.value=true;error.value='';notice.value='';
 try{
  await apiJson(path(workspace,rowPath(row.id)),'DELETE');
  if(workspace!==props.workspaceId)return;
  await load();if(workspace===props.workspaceId)notice.value='Archivo eliminado.';
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo eliminar el archivo.';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,()=>{title.value='';courseId.value='';file.value=null;if(fileInput.value)fileInput.value.value='';notice.value='';void load();});
onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3"><FileUp :size="22" class="text-brand"/><div>
   <h2 class="text-lg font-extrabold">Archivos privados</h2><p class="mt-1 text-xs text-muted">Materiales protegidos por matrícula y permisos del curso.</p>
  </div></div></template>
  <UiAlert v-if="!loading&&!enabled" tone="warning">Las nuevas cargas y publicaciones están deshabilitadas en el servidor. Puedes consultar o retirar los archivos existentes.</UiAlert>
  <form v-if="enabled" class="mt-4 grid gap-3 md:grid-cols-2" @submit.prevent="upload">
   <label class="text-xs font-semibold">Título<input v-model="title" required minlength="3" maxlength="140" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
   <label class="text-xs font-semibold">Curso<select v-model="courseId" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"><option value="">Selecciona un curso</option><option v-for="course in courses" :key="course.id" :value="course.id">{{course.title}}</option></select></label>
   <label class="text-xs font-semibold md:col-span-2">Archivo (PDF, PNG o JPEG · máximo 5 MiB)
    <input ref="fileInput" type="file" accept="application/pdf,image/png,image/jpeg" required :disabled="busy" class="mt-2 block w-full rounded-xl border border-outline bg-surface p-3 text-sm" @change="choose"/>
   </label>
   <p class="text-xs text-muted md:col-span-2">Cuota total: 100 MiB por academia. La comprobación de formato no es un análisis antivirus.</p>
   <UiButton type="submit" :disabled="busy||!file||!courseId" :loading="busy">Guardar borrador</UiButton>
  </form>
  <div class="mt-5 flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-extrabold">Archivos del curso</h3><UiButton variant="ghost" size="sm" :disabled="busy||loading" @click="load"><RefreshCw :size="14"/> Actualizar</UiButton></div>
  <p v-if="loading" class="mt-3 text-xs text-muted">Consultando archivos…</p>
  <p v-else-if="!files.length" class="mt-3 text-xs text-muted">No hay archivos privados disponibles.</p>
  <div v-else class="mt-3 space-y-2">
   <article v-for="row in files" :key="row.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-3">
    <div class="min-w-0"><p class="break-words text-sm font-bold">{{row.title}}</p><p class="mt-1 break-all text-xs text-muted">{{row.filename}} · {{(row.sizeBytes/1024).toFixed(1)}} KiB · {{courses.find(c=>c.id===row.courseId)?.title||'Curso'}}</p><p :class="row.published?'text-success':'text-warning'" class="mt-1 text-xs font-semibold">{{row.published?'Publicado':'Borrador'}}</p></div>
    <div class="flex flex-wrap items-center gap-2">
     <a :href="path(workspaceId,rowPath(row.id)+'/download')" download class="inline-flex items-center gap-1 rounded-lg border border-outline px-3 py-2 text-xs font-semibold"><Download :size="14"/> Descargar</a>
     <UiButton size="sm" variant="secondary" :disabled="busy||(!enabled&&!row.published)" @click="publication(row)">{{row.published?'Retirar':'Publicar'}}</UiButton>
     <UiButton size="sm" variant="ghost" :disabled="busy" @click="remove(row)"><Trash2 :size="14"/> Eliminar</UiButton>
    </div>
   </article>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-3">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-3">{{notice}}</UiAlert>
 </UiCard>
</template>
