<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {Building2,DoorOpen,Plus,ShieldCheck} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Room={id:string;campusId:string;name:string;capacity:number;active:boolean};
type Campus={id:string;name:string;address:string;active:boolean;rooms:Room[]};
const props=defineProps<{workspaceId:string;editable:boolean}>();
const emit=defineEmits<{updated:[]}>();
const campuses=ref<Campus[]>([]),loading=ref(true),busy=ref(false);
const error=ref(''),notice=ref('');
const campusName=ref(''),campusAddress=ref(''),roomCampusId=ref('');
const roomName=ref(''),roomCapacity=ref(30);
let version=0;
function request<T>(workspaceId:string,path:string,method='GET',body?:unknown){
 return apiJson<T>(workspacePath(workspaceId,'/locations'+path),method,body);
}
async function load(){
 const workspaceId=props.workspaceId,requestVersion=++version;
 loading.value=true;campuses.value=[];error.value='';
 try{
  const rows=await request<Campus[]>(workspaceId,'/campuses');
  if(requestVersion!==version||workspaceId!==props.workspaceId)return;
  campuses.value=rows;
  if(!rows.some(c=>c.id===roomCampusId.value&&c.active)){
   roomCampusId.value=rows.find(c=>c.active)?.id??'';
  }
 }catch(e){
  if(requestVersion===version&&workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudieron consultar las sedes y aulas.';
  }
 }finally{if(requestVersion===version)loading.value=false;}
}
async function mutate(path:string,method:string,body:unknown,success:string){
 if(busy.value||!props.editable)return;
 const workspaceId=props.workspaceId;
 busy.value=true;error.value='';notice.value='';
 try{
  await request(workspaceId,path,method,body);
  if(workspaceId!==props.workspaceId)return;
  await load();
  if(workspaceId===props.workspaceId){
   notice.value=success;
   emit('updated');
  }
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo actualizar la sede o el aula.';
  }
 }finally{busy.value=false;}
}
async function createCampus(){
 await mutate('/campuses','POST',{name:campusName.value,address:campusAddress.value},'Sede creada.');
 if(!error.value){campusName.value='';campusAddress.value='';}
}
async function createRoom(){
 await mutate('/campuses/'+encodeURIComponent(roomCampusId.value)+'/rooms','POST',{
  name:roomName.value,capacity:roomCapacity.value,
 },'Aula creada.');
 if(!error.value){roomName.value='';roomCapacity.value=30;}
}
function toggleCampus(campus:Campus){
 if(campus.active&&!window.confirm('¿Desactivar esta sede? No debe tener clases futuras confirmadas.'))return;
 void mutate('/campuses/'+encodeURIComponent(campus.id),'PATCH',{
  active:!campus.active,
 },campus.active?'Sede desactivada.':'Sede reactivada.');
}
function toggleRoom(room:Room){
 if(room.active&&!window.confirm('¿Desactivar esta aula? No debe tener clases futuras confirmadas.'))return;
 void mutate('/rooms/'+encodeURIComponent(room.id),'PATCH',{
  active:!room.active,
 },room.active?'Aula desactivada.':'Aula reactivada.');
}
function saveCapacity(room:Room){
 void mutate('/rooms/'+encodeURIComponent(room.id),'PATCH',{
  capacity:room.capacity,
 },'Capacidad del aula actualizada.');
}
watch(()=>props.workspaceId,()=>{
 ++version;busy.value=false;error.value='';notice.value='';
 roomCampusId.value='';campusName.value='';campusAddress.value='';
 void load();
});
onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header>
   <div class="flex items-center gap-3"><Building2 :size="22" class="text-brand"/><div>
    <h2 class="text-lg font-extrabold">Sedes y aulas</h2>
    <p class="mt-1 text-xs text-muted">Controla ubicaciones, capacidad y disponibilidad física. Dos clases no pueden reservar la misma aula simultáneamente.</p>
   </div></div>
  </template>
  <p v-if="loading" class="text-xs text-muted">Consultando sedes…</p>
  <div v-else class="space-y-4">
   <div v-if="editable" class="grid gap-4 lg:grid-cols-2">
    <form class="rounded-xl border border-outline p-4" @submit.prevent="createCampus">
     <h3 class="text-sm font-bold">Crear sede</h3>
     <label class="mt-3 block text-xs font-semibold">Nombre<input v-model="campusName" required minlength="3" maxlength="100" placeholder="Ej. Sede Principal" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
     <label class="mt-3 block text-xs font-semibold">Dirección<input v-model="campusAddress" required minlength="5" maxlength="300" placeholder="Calle 10 #30-20" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
     <UiButton class="mt-3" type="submit" size="sm" :disabled="busy" :loading="busy"><Plus :size="14"/> Crear sede</UiButton>
    </form>
    <form class="rounded-xl border border-outline p-4" @submit.prevent="createRoom">
     <h3 class="text-sm font-bold">Agregar aula a una sede</h3>
     <label class="mt-3 block text-xs font-semibold">Sede<select v-model="roomCampusId" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
      <option v-for="campus in campuses.filter(c=>c.active)" :key="campus.id" :value="campus.id">{{campus.name}}</option>
     </select></label>
     <div class="mt-3 grid grid-cols-2 gap-3">
      <label class="text-xs font-semibold">Aula<input v-model="roomName" required minlength="2" maxlength="100" placeholder="Aula 101" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
      <label class="text-xs font-semibold">Capacidad<input v-model.number="roomCapacity" required type="number" min="1" max="500" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
     </div>
     <UiButton class="mt-3" type="submit" size="sm" :disabled="busy||!roomCampusId" :loading="busy"><Plus :size="14"/> Agregar aula</UiButton>
    </form>
   </div>
   <div v-for="campus in campuses" :key="campus.id" class="rounded-xl border border-outline p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
     <div>
      <h3 class="text-sm font-bold">{{campus.name}}</h3>
      <p class="mt-1 text-xs text-muted">{{campus.address}} · {{campus.active?'Activa':'Inactiva'}}</p>
     </div>
     <UiButton v-if="editable" variant="secondary" size="sm" :disabled="busy" @click="toggleCampus(campus)">
      {{campus.active?'Desactivar sede':'Reactivar sede'}}
     </UiButton>
    </div>
    <div v-if="campus.rooms.length" class="mt-3 grid gap-2 md:grid-cols-2">
     <div v-for="room in campus.rooms" :key="room.id" class="rounded-lg bg-surface-muted p-3">
      <p class="flex items-center gap-2 text-sm font-bold"><DoorOpen :size="16"/>{{room.name}}</p>
      <p class="mt-1 text-xs text-muted">{{room.active?'Disponible':'Inactiva'}} · {{room.capacity}} personas</p>
      <div v-if="editable" class="mt-3 flex flex-wrap items-end gap-2">
       <label class="text-xs font-semibold">Cupos máximos<input v-model.number="room.capacity" type="number" min="1" max="500" class="mt-1 block w-24 rounded-lg border border-outline bg-surface p-2 text-xs"/></label>
       <UiButton variant="secondary" size="sm" :disabled="busy" @click="saveCapacity(room)">Guardar cupos</UiButton>
       <UiButton variant="secondary" size="sm" :disabled="busy" @click="toggleRoom(room)">{{room.active?'Desactivar':'Reactivar'}}</UiButton>
      </div>
     </div>
    </div>
    <p v-else class="mt-3 text-xs text-muted">Todavía no hay aulas en esta sede.</p>
   </div>
   <p v-if="!campuses.length" class="text-xs text-muted">Aún no se han registrado sedes.</p>
   <p class="flex items-center gap-2 text-xs text-muted"><ShieldCheck :size="14"/> No se permite desactivar una sede o aula utilizada por clases futuras confirmadas.</p>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-4">{{notice}}</UiAlert>
 </UiCard>
</template>
