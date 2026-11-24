<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue';
import {Gift,PackageCheck,RefreshCw,Ticket,ClipboardList,ShieldX,Download} from 'lucide-vue-next';
import {UiAlert,UiButton,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';
import {serializeCreditAuditCsv,creditAuditFilename} from '../shared/credit-audit-csv';

type Plan={
 id:string;title:string;courseId:string|null;courseRestricted:boolean;sessionCredits:number;
 priceCOP:number;validDays:number;active:boolean;createdAt:string;
};
type GrantRow={
 id:string;credits:number;used:number;remaining:number;available:number;
 expiresAt:string;issuedAt:string;revokedAt:string|null;
 revokedByUserId:string|null;revokeReason:string|null;futureBookings:number;
 package:{title:string;courseId:string|null;priceCOP:number};
 student:{name:string};issuer:{name:string};
};
type Member={role:string;user:{id:string;name:string;email:string}};
const props=defineProps<{
 workspaceId:string;students:Member[];courses:Array<{id:string;title:string}>;
}>();
const plans=ref<Plan[]>([]),loading=ref(true),busy=ref(false);
const grants=ref<GrantRow[]>([]),grantsLoading=ref(false),grantsError=ref('');
const revocationReason=ref<Record<string,string>>({});
const error=ref(''),notice=ref('');
const name=ref(''),courseId=ref(''),credits=ref(4),price=ref(160000),days=ref(30);
const selectedPlan=ref(''),selectedStudent=ref(''),issueNote=ref('');
const selected=computed(()=>plans.value.find(plan=>plan.id===selectedPlan.value)??null);
const enrolledStudents=computed(()=>props.students.filter(m=>m.role==='STUDENT'));
let issueRequestId='',version=0,grantsVersion=0;
function money(v:number){return new Intl.NumberFormat('es-CO',{
 style:'currency',currency:'COP',maximumFractionDigits:0,
}).format(v);}
function request<T>(workspaceId:string,path:string,method='GET',body?:unknown){
 return apiJson<T>(workspacePath(workspaceId,'/packages'+path),method,body);
}
function resetIssue(){issueRequestId='';}
async function load(){
 const workspace=props.workspaceId,n=++version;
 loading.value=true;plans.value=[];error.value='';
 try{
  const list=await request<Plan[]>(workspace,'');
  if(n!==version||workspace!==props.workspaceId)return;
  plans.value=list;
  if(!plans.value.some(p=>p.id===selectedPlan.value))selectedPlan.value=list.find(p=>p.active)?.id??'';
 }catch(e){
  if(n===version&&workspace===props.workspaceId)
   error.value=e instanceof Error?e.message:'No se pudieron cargar los paquetes.';
 }finally{if(n===version)loading.value=false;}
}
async function loadGrants(){
 const workspace=props.workspaceId,n=++grantsVersion;
 grantsLoading.value=true;grantsError.value='';grants.value=[];
 try{
  const result=await request<GrantRow[]>(workspace,'/issuances');
  if(n!==grantsVersion||workspace!==props.workspaceId)return;
  grants.value=result;
 }catch(e){
  if(n===grantsVersion&&workspace===props.workspaceId){
   grantsError.value=e instanceof Error?e.message:'No se pudo abrir el historial de créditos.';
  }
 }finally{if(n===grantsVersion)grantsLoading.value=false;}
}
function exportGrantsCsv(){
 if(grantsLoading.value||grantsError.value||!grants.value.length)return;
 const workspace=props.workspaceId;
 // No network call: only the current workspace's authorized, already-loaded rows.
 const csv=serializeCreditAuditCsv(grants.value);
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;
 link.download=creditAuditFilename(workspace);
 document.body.appendChild(link);
 try{link.click();}finally{link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
async function revokeGrant(grant:GrantRow){
 if(busy.value||grant.revokedAt||grant.futureBookings)return;
 const reason=revocationReason.value[grant.id]?.trim()??'';
 if(reason.length<6)return;
 if(!window.confirm('¿Revocar los créditos restantes de "'+grant.package.title+'" para '+grant.student.name+'? Se guardará el motivo y el estudiante recibirá un aviso interno. No se reembolsará dinero.'))return;
 const workspace=props.workspaceId;
 busy.value=true;error.value='';notice.value='';
 try{
  await request(workspace,'/entitlements/'+encodeURIComponent(grant.id)+'/revoke','PATCH',{reason});
  if(workspace!==props.workspaceId)return;
  delete revocationReason.value[grant.id];
  await loadGrants();
  if(workspace===props.workspaceId)notice.value='Asignación revocada y registrada. Se avisó al estudiante.';
 }catch(e){
  if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudieron revocar los créditos.';
 }finally{busy.value=false;}
}
async function create(){
 if(busy.value)return;
 const workspace=props.workspaceId;
 busy.value=true;error.value='';notice.value='';
 try{
  await request(workspace,'','POST',{
   title:name.value,sessionCredits:credits.value,priceCOP:price.value,
   validDays:days.value,courseId:courseId.value||null,
  });
  if(workspace!==props.workspaceId)return;
  name.value='';await load();notice.value='Paquete creado. Su precio es informativo; no se ha cobrado ningún pago.';
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No fue posible crear el paquete.';}
 finally{busy.value=false;}
}
async function toggle(plan:Plan){
 if(busy.value)return;
 const workspace=props.workspaceId;busy.value=true;error.value='';notice.value='';
 try{
  await request(workspace,'/'+encodeURIComponent(plan.id)+'/active','PATCH',{active:!plan.active});
  if(workspace!==props.workspaceId)return;
  await load();
  notice.value=plan.active?'Se suspendió la emisión de nuevos créditos. Los ya emitidos siguen vigentes.':'Paquete activado.';
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudo cambiar el estado.';}
 finally{busy.value=false;}
}
async function issue(){
 if(busy.value||!selected.value||!selectedStudent.value)return;
 const workspace=props.workspaceId,plan=selected.value;
 if(!window.confirm('¿Confirmas que deseas asignar '+plan.sessionCredits+' créditos a este alumno? Esta acción NO realiza ni confirma un cobro automático.'))return;
 if(!issueRequestId)issueRequestId=crypto.randomUUID();
 busy.value=true;error.value='';notice.value='';
 try{
  await request(workspace,'/'+encodeURIComponent(plan.id)+'/issue','POST',{
   studentUserId:selectedStudent.value,requestId:issueRequestId,
   ...(issueNote.value.trim()?{note:issueNote.value.trim()}:{}),
  });
  if(workspace!==props.workspaceId)return;
  issueRequestId='';issueNote.value='';
  await loadGrants();
  notice.value='Créditos asignados. Se notificó al alumno dentro de AcademyOS; no se procesó un pago.';
 }catch(e){if(workspace===props.workspaceId)error.value=e instanceof Error?e.message:'No se pudieron asignar créditos.';}
 finally{busy.value=false;}
}
watch(()=>[selectedPlan.value,selectedStudent.value,issueNote.value],resetIssue);
watch(()=>props.workspaceId,()=>{++version;++grantsVersion;plans.value=[];grants.value=[];revocationReason.value={};selectedPlan.value='';selectedStudent.value='';issueRequestId='';notice.value='';void load();void loadGrants();});
onMounted(()=>{void load();void loadGrants();});
</script>
<template>
 <UiCard class="mt-6">
  <template #header><div class="flex items-center gap-3">
   <Ticket :size="22" class="text-brand"/>
   <div><h2 class="text-lg font-extrabold">Paquetes de clases</h2>
    <p class="mt-1 text-xs text-muted">Crea bonos de clases, configura vigencia y asigna créditos manualmente.</p>
   </div></div></template>
  <UiAlert tone="warning">
   Los precios son orientativos. Asignar un paquete no significa que el alumno haya pagado; AcademyOS todavía no procesa pagos en línea. Verifica el cobro por tu cuenta antes de otorgar créditos.
  </UiAlert>
  <div class="mt-5 grid gap-6 lg:grid-cols-2">
   <form class="space-y-3" @submit.prevent="create">
    <h3 class="flex items-center gap-2 text-sm font-extrabold"><PackageCheck :size="17"/> Crear paquete</h3>
    <label class="block text-xs font-semibold">Nombre
     <input v-model="name" required minlength="3" maxlength="120" placeholder="4 clases de conversación"
      class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/>
    </label>
    <label class="block text-xs font-semibold">Curso incluido
     <select v-model="courseId" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
      <option value="">Cualquier curso del alumno</option>
      <option v-for="c in courses" :key="c.id" :value="c.id">{{c.title}}</option>
     </select>
    </label>
    <div class="grid grid-cols-3 gap-2">
     <label class="text-xs font-semibold">Créditos<input v-model.number="credits" required type="number" min="1" max="200"
      class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
     <label class="text-xs font-semibold">Precio COP<input v-model.number="price" required type="number" min="0" max="500000000"
      class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
     <label class="text-xs font-semibold">Vigencia (días)<input v-model.number="days" required type="number" min="1" max="365"
      class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
    </div>
    <UiButton type="submit" :loading="busy" :disabled="busy">Crear paquete</UiButton>
   </form>
   <form class="space-y-3" @submit.prevent="issue">
    <h3 class="flex items-center gap-2 text-sm font-extrabold"><Gift :size="17"/> Asignar créditos</h3>
    <label class="block text-xs font-semibold">Paquete activo
     <select v-model="selectedPlan" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
      <option value="">Selecciona un paquete</option>
      <option v-for="plan in plans.filter(p=>p.active)" :key="plan.id" :value="plan.id">{{plan.title}} · {{plan.sessionCredits}} clases</option>
     </select>
    </label>
    <label class="block text-xs font-semibold">Alumno
     <select v-model="selectedStudent" required class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm">
      <option value="">Selecciona alumno</option>
      <option v-for="member in enrolledStudents" :key="member.user.id" :value="member.user.id">{{member.user.name}}</option>
     </select>
    </label>
    <label class="block text-xs font-semibold">Nota interna de emisión (opcional)
     <textarea v-model="issueNote" maxlength="280" rows="2" placeholder="Referencia verificada fuera de AcademyOS"
      class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"></textarea>
    </label>
    <p v-if="selected" class="text-xs text-muted">Este paquete asigna {{selected.sessionCredits}} clases durante {{selected.validDays}} días, valor informativo {{money(selected.priceCOP)}}. El estudiante debe estar matriculado en el curso asociado, cuando corresponda.</p>
    <UiButton type="submit" :loading="busy" :disabled="busy||!selectedPlan||!selectedStudent">Asignar paquete</UiButton>
   </form>
  </div>
  <div class="mt-6 border-t border-outline pt-5">
   <div class="flex items-center justify-between gap-2"><h3 class="text-sm font-extrabold">Paquetes configurados</h3>
    <UiButton variant="ghost" size="sm" @click="load"><RefreshCw :size="14"/> Actualizar</UiButton></div>
   <p v-if="loading" class="mt-3 text-xs text-muted">Consultando paquetes…</p>
   <div v-else class="mt-3 space-y-2">
    <div v-for="plan in plans" :key="plan.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline p-3">
     <div><p class="text-sm font-bold">{{plan.title}}</p>
      <p class="mt-1 text-xs text-muted">{{plan.sessionCredits}} clases · {{plan.validDays}} días · {{money(plan.priceCOP)}} · {{plan.courseRestricted?(plan.courseId?courses.find(c=>c.id===plan.courseId)?.title??'Curso':'Curso eliminado · no válido'):'Todos los cursos'}}</p>
     </div>
     <UiButton size="sm" variant="secondary" :disabled="busy" @click="toggle(plan)">
      {{plan.active?'Suspender emisión':'Reactivar'}}
     </UiButton>
    </div>
    <p v-if="!plans.length" class="text-xs text-muted">Aún no hay paquetes de clases.</p>
   </div>
  </div>
  <section class="mt-6 border-t border-outline pt-5">
   <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-2"><ClipboardList :size="18" class="text-brand"/>
     <h3 class="text-sm font-extrabold">Historial de créditos emitidos</h3>
    </div>
    <div class="flex flex-wrap items-center gap-2">
     <UiButton size="sm" variant="secondary" :disabled="grantsLoading||!!grantsError||!grants.length" @click="exportGrantsCsv">
      <Download :size="14"/> Exportar CSV
     </UiButton>
     <UiButton size="sm" variant="secondary" :disabled="grantsLoading" @click="loadGrants">
      <RefreshCw :size="14"/> Actualizar
     </UiButton>
    </div>
   </div>
   <p class="mt-2 text-xs text-muted">Últimas 200 asignaciones de esta academia, ordenadas por emisión. El CSV solo incluye los registros cargados, no es un estado financiero ni un historial completo. Puedes revocar créditos sin uso futuro, registrando un motivo. Las reservas futuras deben cancelarse primero.</p>
   <p v-if="grantsLoading" class="mt-3 text-xs text-muted">Consultando asignaciones…</p>
   <p v-else-if="!grants.length" class="mt-3 text-xs text-muted">Todavía no hay asignaciones registradas.</p>
   <div v-else class="mt-3 max-h-[650px] space-y-3 overflow-y-auto">
    <article v-for="grant in grants" :key="grant.id" class="rounded-xl border border-outline p-4">
     <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
       <p class="text-sm font-bold">{{grant.student.name}}</p>
       <p class="mt-1 text-xs text-muted">{{grant.package.title}} · Emitido por {{grant.issuer.name}}</p>
       <p class="mt-1 text-xs text-muted">{{new Date(grant.issuedAt).toLocaleString('es-CO')}} · Vence {{new Date(grant.expiresAt).toLocaleDateString('es-CO')}}</p>
      </div>
      <div class="text-right">
       <p class="text-base font-extrabold">{{grant.available}} <span class="text-xs font-normal text-muted">aplicables</span></p>
       <p class="text-xs text-muted">{{grant.used}} consumidos de {{grant.credits}}</p>
      </div>
     </div>
     <p v-if="grant.revokedAt" class="mt-3 text-xs text-warning">
      Revocado el {{new Date(grant.revokedAt).toLocaleString('es-CO')}}. Motivo: {{grant.revokeReason||'No registrado'}}
     </p>
     <p v-else-if="grant.futureBookings" class="mt-3 text-xs text-muted">
      {{grant.futureBookings}} reservas futuras utilizan este paquete. Para revocarlo, cancela primero esas reservas.
     </p>
     <form v-else class="mt-3 flex flex-wrap items-end gap-2" @submit.prevent="revokeGrant(grant)">
      <label class="min-w-48 flex-1 text-xs font-semibold">Motivo de revocación
       <input v-model="revocationReason[grant.id]" required minlength="6" maxlength="300"
        placeholder="Corrección administrativa con autorización"
        class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-xs"/>
      </label>
      <UiButton type="submit" size="sm" variant="secondary" :disabled="busy||(revocationReason[grant.id]?.trim().length??0)<6">
       <ShieldX :size="14"/> Revocar créditos
      </UiButton>
     </form>
    </article>
   </div>
   <UiAlert v-if="grantsError" tone="warning" class="mt-3">{{grantsError}}</UiAlert>
  </section>
    <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success" class="mt-4">{{notice}}</UiAlert>
 </UiCard>
</template>
