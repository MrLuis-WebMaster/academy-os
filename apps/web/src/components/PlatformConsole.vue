<script setup lang="ts">
import {onMounted,ref,computed,watch} from 'vue';
import {Building2,ShieldCheck,RefreshCw,History,UsersRound} from 'lucide-vue-next';
import {UiCard,UiButton,UiAlert} from '@academy-os/ui';
import {apiJson} from '../shared/api-client';
type Code='STARTER'|'PRO'|'ACADEMY';
type Academy={id:string;name:string;slug:string;assignment:{plan:Code;validUntil:string|null}|null};
type Overview={academies:number;solo:number;institutional:number;activePro:number;activeAcademy:number;starter:number;expired:number};
type Audit={id:string;actorUserId:string;previousPlan:Code;nextPlan:Code;validUntil:string|null;reason:string;createdAt:string};
const overview=ref<Overview|null>(null),academies=ref<Academy[]>([]),audit=ref<Audit[]>([]);
const loading=ref(false),busy=ref(false),auditLoading=ref(false),moreAcademies=ref(false),moreAudit=ref(false),error=ref(''),notice=ref('');
const selected=ref(''),query=ref(''),plan=ref<Code>('STARTER'),expiration=ref(''),reason=ref('');
let version=0,auditVersion=0;
const filtered=computed(()=>academies.value.filter(a=>(a.name+' '+a.slug).toLowerCase().includes(query.value.trim().toLowerCase())));
const academy=computed(()=>academies.value.find(a=>a.id===selected.value));
const base='/api/v1/platform';
function path(id:string,suffix:string){return base+'/academies/'+encodeURIComponent(id)+suffix;}
function effective(a:Academy){return a.assignment&&(!a.assignment.validUntil||new Date(a.assignment.validUntil)>new Date())?a.assignment.plan:'STARTER';}
async function load(){
 const n=++version;loading.value=true;error.value='';overview.value=null;academies.value=[];moreAcademies.value=false;
 try{
  const [stats,rows]=await Promise.all([apiJson<Overview>(base+'/overview'),apiJson<Academy[]>(base+'/academies')]);
  if(n!==version)return;
  overview.value=stats;academies.value=rows;moreAcademies.value=rows.length===50;
  if(selected.value&&!rows.some(a=>a.id===selected.value))selected.value='';
 }catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo cargar la plataforma.';}
 finally{if(n===version)loading.value=false;}
}
async function loadMore(){
 const cursor=academies.value.at(-1)?.id;if(!cursor||busy.value||loading.value)return;
 const n=version;busy.value=true;
 try{const rows=await apiJson<Academy[]>(base+'/academies?after='+encodeURIComponent(cursor));if(n===version){academies.value.push(...rows);moreAcademies.value=rows.length===50;}}
 catch(e){if(n===version)error.value=e instanceof Error?e.message:'No se pudo cargar más.';}finally{busy.value=false;}
}
async function loadAudit(append=false){
 const id=selected.value,n=++auditVersion,cursor=append?audit.value.at(-1)?.id:null;
 if(!append){audit.value=[];moreAudit.value=false;}
 if(!id){auditLoading.value=false;return;}
 auditLoading.value=true;
 try{
  const rows=await apiJson<Audit[]>(path(id,'/audit')+(cursor?'?after='+encodeURIComponent(cursor):''));
  if(n===auditVersion&&id===selected.value){audit.value=append?[...audit.value,...rows]:rows;moreAudit.value=rows.length===50;}
 }catch(e){if(n===auditVersion)error.value=e instanceof Error?e.message:'No se pudo consultar la auditoría.';}
 finally{if(n===auditVersion)auditLoading.value=false;}
}
watch(selected,()=>{plan.value=academy.value?.assignment?.plan??'STARTER';expiration.value=academy.value?.assignment?.validUntil?.slice(0,10)??'';reason.value='';notice.value='';void loadAudit();});
async function assign(){
 if(!academy.value||busy.value||reason.value.trim().length<6)return;
 const id=selected.value;
 const until=expiration.value?new Date(expiration.value+'T23:59:59Z'):null;
 if(plan.value!=='STARTER'&&(!until||until<=new Date())){error.value='Indica un vencimiento futuro.';return;}
 if(!window.confirm('¿Asignar '+plan.value+' a '+academy.value.name+'? No se realizará un cobro.'))return;
 busy.value=true;error.value='';notice.value='';
 try{
  const result=await apiJson<NonNullable<Academy['assignment']>>(path(id,'/plan'),'PATCH',{plan:plan.value,validUntil:until?.toISOString()??null,reason:reason.value});
  if(id!==selected.value)return;
  const row=academies.value.find(a=>a.id===id);if(row)row.assignment=result;
  reason.value='';notice.value='Plan actualizado y auditado.';
  await Promise.all([loadAudit(),apiJson<Overview>(base+'/overview').then(stats=>{overview.value=stats;})]);
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo completar la operación.';}
 finally{busy.value=false;}
}
onMounted(()=>void load());
</script>
<template>
 <main class="mx-auto max-w-6xl space-y-6 p-5 md:p-10">
  <header class="flex flex-wrap items-start justify-between gap-4"><div><p class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand"><ShieldCheck :size="17"/> Operaciones de plataforma</p><h1 class="mt-2 text-3xl font-extrabold">AcademyOS Admin</h1><p class="mt-2 text-sm text-muted">Gestiona planes y academias sin entrar a sus aulas.</p></div><UiButton variant="secondary" :disabled="busy||loading" @click="load"><RefreshCw :size="16"/> Actualizar</UiButton></header>
  <UiAlert v-if="error" tone="danger">{{error}}</UiAlert>
  <UiAlert v-if="notice" tone="success">{{notice}}</UiAlert>
  <p v-if="loading" role="status" class="text-sm text-muted">Cargando plataforma…</p>
  <template v-if="overview">
   <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <UiCard v-for="item in [{label:'Espacios educativos',value:overview.academies},{label:'Starter efectivo',value:overview.starter},{label:'Pro vigente',value:overview.activePro},{label:'Academy vigente',value:overview.activeAcademy}]" :key="item.label">
     <p class="text-xs text-muted">{{item.label}}</p><p class="mt-2 text-3xl font-extrabold">{{item.value}}</p>
    </UiCard>
   </div>
   <p class="text-xs text-muted">{{overview.solo}} espacios individuales · {{overview.institutional}} institucionales · {{overview.expired}} asignaciones de pago vencidas. Son asignaciones, no ingresos comprobados.</p>
  </template>
  <div v-if="!loading&&overview" class="grid items-start gap-5 lg:grid-cols-[1fr_1fr]">
   <UiCard>
    <h2 class="flex items-center gap-2 font-extrabold"><Building2 :size="19"/> Academias</h2>
    <label class="block text-xs font-semibold">Buscar en las academias cargadas<input v-model="query" placeholder="Nombre o slug" class="mt-2 w-full rounded-xl border border-outline bg-surface p-3 text-sm"/></label>
    <p v-if="!filtered.length" class="text-xs text-muted">No hay resultados en esta página.</p>
    <button v-for="a in filtered" :key="a.id" type="button" :disabled="busy" :aria-pressed="selected===a.id" :class="selected===a.id?'border-brand bg-brand-soft':'border-outline'" class="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left" @click="selected=a.id">
     <span class="min-w-0"><span class="block break-words text-sm font-bold">{{a.name}}</span><span class="block text-xs text-muted">{{a.slug}}</span></span><span class="text-xs font-bold">{{effective(a)}}</span>
    </button>
    <UiButton v-if="moreAcademies" variant="secondary" :disabled="busy" @click="loadMore">Cargar más</UiButton>
   </UiCard>
   <UiCard>
    <h2 class="flex items-center gap-2 font-extrabold"><UsersRound :size="19"/> Asignación de plan</h2>
    <p v-if="!academy" class="text-sm text-muted">Selecciona una academia para gestionar su plan.</p>
    <form v-else class="space-y-3" @submit.prevent="assign">
     <p class="text-sm font-bold">{{academy.name}} · {{effective(academy)}}</p>
     <label class="block text-xs font-semibold">Plan<select v-model="plan" :disabled="busy" class="mt-2 w-full rounded-lg border border-outline bg-surface p-3"><option>STARTER</option><option>PRO</option><option>ACADEMY</option></select></label>
     <label class="block text-xs font-semibold">Vencimiento (fin del día UTC)<input v-model="expiration" type="date" :disabled="busy" :required="plan!=='STARTER'" class="mt-2 w-full rounded-lg border border-outline bg-surface p-3"/></label>
     <label class="block text-xs font-semibold">Motivo<textarea v-model="reason" required minlength="6" maxlength="300" :disabled="busy" class="mt-2 w-full rounded-lg border border-outline bg-surface p-3"/></label>
     <UiButton type="submit" :disabled="busy||reason.trim().length<6">Asignar plan</UiButton>
    </form>
    <template v-if="academy"><h3 class="mt-4 flex items-center gap-2 border-t border-outline pt-4 text-sm font-extrabold"><History :size="16"/> Auditoría</h3>
     <p v-if="auditLoading" role="status" class="text-xs text-muted">Consultando historial…</p>
     <p v-else-if="!audit.length" class="text-xs text-muted">Sin cambios registrados.</p>
     <article v-for="entry in audit" :key="entry.id" class="rounded-xl border border-outline p-3"><p class="text-sm font-bold">{{entry.previousPlan}} → {{entry.nextPlan}}</p><p class="break-words text-xs">{{entry.reason}}</p><p class="mt-1 break-all text-xs text-muted">{{new Date(entry.createdAt).toLocaleString('es-CO')}} · Operador {{entry.actorUserId}}</p></article>
     <UiButton v-if="moreAudit" size="sm" variant="secondary" :disabled="auditLoading||busy" @click="loadAudit(true)">Más cambios</UiButton>
    </template>
   </UiCard>
  </div>
 </main>
</template>
