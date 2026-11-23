<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {ShieldCheck,UsersRound} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Member={role:string;user:{id:string;name:string;email:string}};
type LinkRow={
 id:string;guardianUserId:string;studentUserId:string;
 status:'PENDING'|'ACTIVE'|'REVOKED';approvedAt:string|null;createdAt:string;
 verificationMethod:string|null;
 guardian:{name:string;email:string};student:{name:string;email:string};
};
const props=defineProps<{workspaceId:string;members:Member[]}>();
const guardianId=ref(''),studentId=ref(''),verificationMethod=ref<'IN_PERSON'|'OTHER_MANUAL_VERIFICATION'>('IN_PERSON');
const verificationNote=ref(''),confirmation=ref(false),revokeReason=ref('Acceso retirado por la administración');
const links=ref<LinkRow[]>([]),loading=ref(true),busy=ref(false),error=ref(''),message=ref('');
const guardians=computed(()=>props.members.filter(m=>m.role==='GUARDIAN'));
const students=computed(()=>props.members.filter(m=>m.role==='STUDENT'));
let version=0;
function api<T>(workspaceId:string,path:string,method='GET',body?:unknown){
 return apiJson<T>(workspacePath(workspaceId,'/guardians'+path),method,body);
}
async function load(){
 const workspaceId=props.workspaceId,request=++version;
 loading.value=true;error.value='';links.value=[];
 try{
  const rows=await api<LinkRow[]>(workspaceId,'/links');
  if(request!==version||workspaceId!==props.workspaceId)return;
  links.value=rows;
  if(!guardians.value.some(m=>m.user.id===guardianId.value))guardianId.value=guardians.value[0]?.user.id??'';
  if(!students.value.some(m=>m.user.id===studentId.value))studentId.value=students.value[0]?.user.id??'';
 }catch(e){
  if(request===version&&workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudieron cargar los vínculos familiares.';
  }
 }finally{if(request===version)loading.value=false;}
}
async function mutate(path:string,method:string,body:unknown,success:string){
 if(busy.value)return;
 const workspaceId=props.workspaceId;
 busy.value=true;error.value='';message.value='';
 try{
  await api(workspaceId,path,method,body);
  if(workspaceId!==props.workspaceId)return;
  await load();
  if(workspaceId===props.workspaceId)message.value=success;
 }catch(e){
  if(workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo completar la solicitud.';
  }
 }finally{busy.value=false;}
}
function start(){
 if(!guardianId.value||!studentId.value)return;
 void mutate('/links','POST',{
  guardianUserId:guardianId.value,studentUserId:studentId.value,
 },'Vínculo creado como pendiente. No se concede acceso hasta que la academia valide la relación.');
}
async function approve(link:LinkRow){
 if(!confirmation.value||verificationNote.value.trim().length<10)return;
 await mutate('/links/'+encodeURIComponent(link.id)+'/approve','PATCH',{
  verificationConfirmed:true,method:verificationMethod.value,
  verificationNote:verificationNote.value,
 },'Relación habilitada. El acudiente puede consultar solo el resumen académico autorizado.');
 confirmation.value=false;verificationNote.value='';
}
function revoke(link:LinkRow){
 if(!window.confirm('¿Retirar el acceso familiar a este estudiante?'))return;
 void mutate('/links/'+encodeURIComponent(link.id)+'/revoke','PATCH',{
  reason:revokeReason.value,
 },'Acceso del acudiente retirado y registrado.');
}
watch(()=>props.workspaceId,()=>{
 ++version;busy.value=false;message.value='';error.value='';
 guardianId.value='';studentId.value='';
 void load();
});
onMounted(()=>void load());
</script>
<template>
 <UiCard class="mt-6">
  <template #header>
   <div class="flex items-center gap-3"><UsersRound :size="22" class="text-brand"/><div>
    <h2 class="text-lg font-extrabold">Acudientes y estudiantes</h2>
    <p class="mt-1 text-xs text-muted">Los vínculos familiares deben verificarse manualmente antes de habilitar acceso académico.</p>
   </div></div>
  </template>
  <UiAlert tone="warning">
   Esta herramienta NO comprueba por sí misma el parentesco ni la autorización legal.
   La academia debe verificar la identidad y conservar el consentimiento requerido fuera de AcademyOS antes de aprobar el vínculo.
   No incluyas documentos de identidad ni datos sensibles en las observaciones.
  </UiAlert>
  <div v-if="!guardians.length||!students.length" class="mt-4 text-xs text-muted">
   Para establecer un vínculo, invita primero a una persona con rol Acudiente y a un estudiante.
   Ambas cuentas deben aceptar su invitación.
  </div>
  <form v-else class="mt-4 grid gap-3 md:grid-cols-2" @submit.prevent="start">
   <label class="text-xs font-semibold">Cuenta del acudiente
    <select v-model="guardianId" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
     <option v-for="item in guardians" :key="item.user.id" :value="item.user.id">{{item.user.name}} · {{item.user.email}}</option>
    </select>
   </label>
   <label class="text-xs font-semibold">Estudiante
    <select v-model="studentId" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
     <option v-for="item in students" :key="item.user.id" :value="item.user.id">{{item.user.name}} · {{item.user.email}}</option>
    </select>
   </label>
   <div class="md:col-span-2"><UiButton size="sm" type="submit" :loading="busy" :disabled="busy">Solicitar verificación del vínculo</UiButton></div>
  </form>
  <p v-if="loading" class="mt-4 text-xs text-muted">Consultando vínculos…</p>
  <div v-else-if="links.length" class="mt-5 space-y-3">
   <div v-for="link in links" :key="link.id" class="rounded-xl border border-outline p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
     <div>
      <p class="text-sm font-bold">{{link.guardian.name}} → {{link.student.name}}</p>
      <p class="mt-1 text-xs text-muted">{{link.guardian.email}} · {{link.student.email}}</p>
      <p class="mt-2 text-xs font-semibold">{{link.status==='PENDING'?'Pendiente de verificación':link.status==='ACTIVE'?'Acceso aprobado':'Acceso revocado'}}</p>
     </div>
     <UiButton v-if="link.status!=='REVOKED'" size="sm" variant="secondary" :disabled="busy" @click="revoke(link)">Revocar acceso</UiButton>
    </div>
    <form v-if="link.status==='PENDING'" class="mt-4 space-y-3 border-t border-outline pt-4" @submit.prevent="approve(link)">
     <label class="block text-xs font-semibold">Tipo de verificación externa
      <select v-model="verificationMethod" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
       <option value="IN_PERSON">Presencial</option>
       <option value="OTHER_MANUAL_VERIFICATION">Otro proceso verificado</option>
      </select>
     </label>
     <label class="block text-xs font-semibold">Constancia breve (sin datos de documentos)
      <textarea v-model="verificationNote" required minlength="10" maxlength="300" rows="2" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm" placeholder="Ej. Administración comprobó la relación autorizada presencialmente"></textarea>
     </label>
     <label class="flex items-start gap-2 text-xs"><input v-model="confirmation" required type="checkbox" class="mt-0.5 accent-brand"/> Confirmo que el vínculo y los permisos del acudiente fueron verificados fuera de AcademyOS.</label>
     <UiButton size="sm" type="submit" :loading="busy" :disabled="busy||!confirmation||verificationNote.trim().length<10"><ShieldCheck :size="15"/> Aprobar vínculo</UiButton>
    </form>
   </div>
  </div>
  <p v-else class="mt-4 text-xs text-muted">Todavía no hay vínculos familiares registrados.</p>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="message" tone="success" class="mt-4">{{message}}</UiAlert>
 </UiCard>
</template>
