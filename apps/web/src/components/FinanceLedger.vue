<script setup lang="ts">
import {onMounted,ref,watch} from 'vue';
import {WalletCards,CheckCircle2} from 'lucide-vue-next';
const props=defineProps<{
 workspaceId:string;role:string;
 students:Array<{role:string;user:{id:string;name:string}}>;
 courses:Array<{id:string;title:string}>;
}>();
type Receipt={id:string;amountCOP:number;method:'CASH'|'BANK_TRANSFER'|'OTHER';reference:string|null;receivedAt:string;voidedAt:string|null;student:{name:string};course:{title:string}|null};
type Summary={currency:string;totalReceivedCOP:number;receiptCount:number};
const receipts=ref<Receipt[]>([]),summary=ref<Summary|null>(null),loading=ref(false),busy=ref(false),error=ref(''),message=ref('');
const studentUserId=ref(''),courseId=ref(''),amountCOP=ref(50000),method=ref<'CASH'|'BANK_TRANSFER'|'OTHER'>('BANK_TRANSFER'),reference=ref('');
function money(value:number){return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);}
async function api<T>(suffix:string,verb='GET',body?:unknown):Promise<T>{
 const r=await fetch('/api/v1/workspaces/'+props.workspaceId+'/finance'+suffix,{
  method:verb,credentials:'same-origin',
  ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})
 });
 const data:unknown=await r.json().catch(()=>null);
 if(!r.ok)throw Error(data&&typeof data==='object'&&'message' in data&&typeof data.message==='string'?data.message:'No se pudo completar el registro.');
 return data as T;
}
async function load(){
 loading.value=true;
 try{const [list,total]=await Promise.all([api<Receipt[]>('/receipts'),api<Summary>('/summary')]);receipts.value=list;summary.value=total;error.value='';}
 catch(e){error.value=e instanceof Error?e.message:'No se pudo cargar finanzas';}
 finally{loading.value=false;}
}
async function record(){
 busy.value=true;error.value='';message.value='';
 try{
  await api('/receipts','POST',{studentUserId:studentUserId.value,...(courseId.value?{courseId:courseId.value}:{}),amountCOP:amountCOP.value,method:method.value,reference:reference.value});
  reference.value='';await load();message.value='Cobro registrado. AcademyOS no procesó dinero.';
 }catch(e){error.value=e instanceof Error?e.message:'No se pudo registrar el cobro';}
 finally{busy.value=false;}
}
async function voidReceipt(receipt:Receipt){
 const reason=window.prompt('Indica el motivo para anular este registro (no se devuelve dinero automáticamente):');
 if(!reason)return;
 busy.value=true;error.value='';message.value='';
 try{await api('/receipts/'+receipt.id+'/void','PATCH',{reason});await load();message.value='Registro anulado con motivo auditado.';}
 catch(e){error.value=e instanceof Error?e.message:'No se pudo anular el registro';}
 finally{busy.value=false;}
}
watch(()=>props.workspaceId,load);
onMounted(load);
</script>
<template>
<section class="mt-6 rounded-2xl border border-outline bg-white p-6">
 <div class="flex items-center gap-2"><WalletCards :size="22" class="text-brand"/><div><h2 class="text-lg font-extrabold">Cobros registrados</h2><p class="mt-1 text-xs text-muted">Registro manual de efectivo o transferencias ya recibidas. No es una pasarela de pagos ni emite facturas.</p></div></div>
 <div class="mt-5 rounded-2xl bg-violet-50 p-5"><p class="text-xs font-bold text-brand">Total neto registrado</p><p class="mt-2 text-2xl font-extrabold">{{ loading?'…':money(summary?.totalReceivedCOP??0) }}</p><p class="mt-1 text-xs text-muted">{{ summary?.receiptCount??0 }} comprobantes activos</p></div>
 <form class="mt-5 grid gap-3 md:grid-cols-3" @submit.prevent="record">
  <label class="text-xs font-semibold">Alumno<select v-model="studentUserId" required class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"><option value="">Elegir alumno</option><option v-for="m in students.filter(x=>x.role==='STUDENT')" :key="m.user.id" :value="m.user.id">{{ m.user.name }}</option></select></label>
  <label class="text-xs font-semibold">Curso<select v-model="courseId" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"><option value="">Sin curso</option><option v-for="course in courses" :key="course.id" :value="course.id">{{ course.title }}</option></select></label>
  <label class="text-xs font-semibold">Monto recibido (COP)<input v-model.number="amountCOP" required type="number" min="1" max="500000000" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"/></label>
  <label class="text-xs font-semibold">Medio<select v-model="method" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm"><option value="BANK_TRANSFER">Transferencia</option><option value="CASH">Efectivo</option><option value="OTHER">Otro</option></select></label>
  <label class="text-xs font-semibold">Referencia (opcional)<input v-model="reference" maxlength="80" class="mt-2 w-full rounded-xl border border-outline p-3 text-sm" placeholder="Número de comprobante"/></label>
  <button :disabled="busy || !students.some(x=>x.role==='STUDENT')" class="self-end rounded-xl bg-brand p-3 text-xs font-bold text-white disabled:opacity-50">Registrar cobro recibido</button>
 </form>
 <p v-if="error" role="alert" class="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{{ error }}</p>
 <p v-if="message" role="status" class="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 :size="15"/>{{ message }}</p>
 <div class="mt-6 divide-y divide-outline">
  <div v-for="receipt in receipts" :key="receipt.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
   <div><p class="text-sm font-bold">{{ receipt.student.name }} · {{ money(receipt.amountCOP) }}</p><p class="mt-1 text-xs text-muted">{{ receipt.course?.title??'Sin curso' }} · {{ receipt.method==='CASH'?'Efectivo':receipt.method==='BANK_TRANSFER'?'Transferencia':'Otro' }} · {{ new Date(receipt.receivedAt).toLocaleDateString('es-CO') }}</p></div>
   <span v-if="receipt.voidedAt" class="text-xs font-bold text-slate-400">Anulado</span>
   <button v-else-if="role==='OWNER'" :disabled="busy" class="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50" @click="voidReceipt(receipt)">Anular</button>
  </div>
  <p v-if="!receipts.length" class="py-4 text-xs text-muted">Todavía no hay cobros registrados.</p>
 </div>
</section>
</template>