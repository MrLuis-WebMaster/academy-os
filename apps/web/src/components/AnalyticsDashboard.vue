<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {Activity,BarChart3,BookOpen,GraduationCap,UsersRound,Wallet} from 'lucide-vue-next';
import {UiAlert,UiCard} from '@academy-os/ui';
import {apiJson,workspacePath} from '../shared/api-client';

type Report={
 period:'7d'|'30d'|'90d';from:string;through:string;
 people:{students:number;teachers:number;courses:number};
 classes:{scheduled:number;completed:number;cancelled:number;bookedSeats:number;attendanceRecorded:number};
 learning:{practiceAttempts:number;averagePracticeScore:number|null;assessedCompetencies:number;activeGoals:number};
 finances:{manualCollectedCOP:number;voidedReceipts:number};
 notes:string[];
};
const props=defineProps<{workspaceId:string}>();
const period=ref<'7d'|'30d'|'90d'>('30d');
const report=ref<Report|null>(null),loading=ref(true),error=ref('');
let version=0;
function money(amount:number){
 return new Intl.NumberFormat('es-CO',{
  style:'currency',currency:'COP',maximumFractionDigits:0,
 }).format(amount);
}
function formatNumber(value:number){
 return new Intl.NumberFormat('es-CO').format(value);
}
async function refresh(){
 const request=++version,workspaceId=props.workspaceId,selected=period.value;
 loading.value=true;error.value='';report.value=null;
 try{
  const result=await apiJson<Report>(
   workspacePath(workspaceId,'/analytics/overview?period='+encodeURIComponent(selected)),
  );
  if(request!==version||workspaceId!==props.workspaceId||selected!==period.value)return;
  report.value=result;
 }catch(e){
  if(request===version&&workspaceId===props.workspaceId){
   error.value=e instanceof Error?e.message:'No se pudo consultar el resumen de la academia.';
  }
 }finally{if(request===version)loading.value=false;}
}
watch(()=>props.workspaceId,()=>{++version;void refresh();});
watch(period,()=>void refresh());
onMounted(()=>void refresh());
</script>
<template>
 <UiCard class="mt-6">
  <template #header>
   <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3"><BarChart3 :size="22" class="text-brand"/>
     <div><h2 class="text-lg font-extrabold">Indicadores de la academia</h2>
      <p class="mt-1 text-xs text-muted">Datos registrados y agregados de este espacio, sin datos ficticios.</p>
     </div>
    </div>
    <label class="text-xs font-semibold">Período
     <select v-model="period" class="ml-2 rounded-lg border border-outline bg-surface px-3 py-2 text-sm">
      <option value="7d">7 días</option><option value="30d">30 días</option><option value="90d">90 días</option>
     </select>
    </label>
   </div>
  </template>
  <p v-if="loading" class="text-xs text-muted">Calculando indicadores…</p>
  <div v-else-if="report" class="space-y-5">
   <p class="text-xs text-muted">Actividad desde {{new Date(report.from).toLocaleDateString('es-CO')}} hasta {{new Date(report.through).toLocaleDateString('es-CO')}}. Alumnos, docentes, cursos y metas activas son totales actuales de la academia.</p>
   <div class="grid gap-3 sm:grid-cols-3">
    <div class="rounded-xl border border-outline p-4">
     <p class="flex items-center gap-2 text-xs text-muted"><UsersRound :size="15"/> Estudiantes</p>
     <p class="mt-2 text-2xl font-extrabold">{{formatNumber(report.people.students)}}</p>
    </div>
    <div class="rounded-xl border border-outline p-4">
     <p class="flex items-center gap-2 text-xs text-muted"><GraduationCap :size="15"/> Docentes</p>
     <p class="mt-2 text-2xl font-extrabold">{{formatNumber(report.people.teachers)}}</p>
    </div>
    <div class="rounded-xl border border-outline p-4">
     <p class="flex items-center gap-2 text-xs text-muted"><BookOpen :size="15"/> Cursos</p>
     <p class="mt-2 text-2xl font-extrabold">{{formatNumber(report.people.courses)}}</p>
    </div>
   </div>
   <div class="grid gap-4 lg:grid-cols-2">
    <section class="rounded-xl border border-outline p-4">
     <h3 class="flex items-center gap-2 text-sm font-bold"><Activity :size="16"/> Clases y reservas</h3>
     <dl class="mt-4 space-y-3 text-sm">
      <div class="flex items-center justify-between"><dt class="text-muted">Clases confirmadas</dt><dd class="font-bold">{{formatNumber(report.classes.scheduled)}}</dd></div>
      <div class="flex items-center justify-between"><dt class="text-muted">Clases completadas</dt><dd class="font-bold">{{formatNumber(report.classes.completed)}}</dd></div>
      <div class="flex items-center justify-between"><dt class="text-muted">Clases canceladas</dt><dd class="font-bold">{{formatNumber(report.classes.cancelled)}}</dd></div>
      <div class="flex items-center justify-between"><dt class="text-muted">Reservas activas de clases del período</dt><dd class="font-bold">{{formatNumber(report.classes.bookedSeats)}}</dd></div>
      <div class="flex items-center justify-between"><dt class="text-muted">Asistencias registradas</dt><dd class="font-bold">{{formatNumber(report.classes.attendanceRecorded)}}</dd></div>
     </dl>
    </section>
    <section class="rounded-xl border border-outline p-4">
     <h3 class="flex items-center gap-2 text-sm font-bold"><BookOpen :size="16"/> Aprendizaje registrado</h3>
     <dl class="mt-4 space-y-3 text-sm">
      <div class="flex items-center justify-between"><dt class="text-muted">Intentos de prácticas</dt><dd class="font-bold">{{formatNumber(report.learning.practiceAttempts)}}</dd></div>
      <div class="flex items-center justify-between"><dt class="text-muted">Puntuación media de intentos</dt><dd class="font-bold">{{report.learning.averagePracticeScore===null?'Sin datos':report.learning.averagePracticeScore+'%'}}</dd></div>
      <div class="flex items-center justify-between"><dt class="text-muted">Evidencias docentes revisadas</dt><dd class="font-bold">{{formatNumber(report.learning.assessedCompetencies)}}</dd></div>
      <div class="flex items-center justify-between"><dt class="text-muted">Metas activas (actual)</dt><dd class="font-bold">{{formatNumber(report.learning.activeGoals)}}</dd></div>
     </dl>
    </section>
   </div>
   <section class="rounded-xl border border-outline p-4">
    <h3 class="flex items-center gap-2 text-sm font-bold"><Wallet :size="16"/> Registro financiero manual</h3>
    <p class="mt-2 text-2xl font-extrabold">{{money(report.finances.manualCollectedCOP)}}</p>
    <p class="mt-1 text-xs text-muted">{{formatNumber(report.finances.voidedReceipts)}} comprobantes anulados durante el período. No equivale a pagos procesados, conciliados ni ingresos auditados.</p>
   </section>
   <ul class="space-y-1 text-xs text-muted">
    <li v-for="(item,i) in report.notes" :key="i">{{item}}</li>
   </ul>
  </div>
  <UiAlert v-if="error" tone="danger" class="mt-4">{{error}}</UiAlert>
 </UiCard>
</template>
