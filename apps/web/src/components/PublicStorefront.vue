<script setup lang="ts">
import {onMounted,ref} from 'vue';
import { UiCard, UiThemeSwitcher, UiBrand } from '@academy-os/ui';
import {BookOpen,CalendarDays,Clock3,GraduationCap,MapPin,Video,ArrowUpRight,Mail} from 'lucide-vue-next';
const props=defineProps<{slug:string}>();
type Offering={id:string;title:string;description:string|null;priceCOP:number;durationMinutes:number;mode:'ONLINE'|'ONSITE'|'HYBRID';course:{title:string;subject:{name:string}|null}|null};
type Academy={name:string;slug:string;description:string|null;brandColor:string;logoUrl:string|null;contactUrl:string|null;timezone:string;offerings:Offering[]};
const academy=ref<Academy|null>(null),error=ref(''),loading=ref(true);
function currency(value:number){return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);}
onMounted(async()=>{
  try{
    const response=await fetch('/api/v1/studio/public/'+encodeURIComponent(props.slug));
    if(!response.ok)throw new Error(response.status===404?'Esta academia no ha publicado su catálogo.':'No pudimos cargar este catálogo.');
    academy.value=await response.json() as Academy;
    document.title=(academy.value.name)+' — AcademyOS';
  }catch(e){error.value=e instanceof Error?e.message:'No se pudo abrir el catálogo.';}
  finally{loading.value=false;}
});
</script>
<template>
  <div class="min-h-screen bg-canvas text-ink">
    <header class="border-b border-outline bg-surface">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <UiBrand href="/" compact />
        <div class="flex items-center gap-2"><UiThemeSwitcher /><a href="/" class="rounded-lg border border-outline px-4 py-2 text-xs font-bold">Ingresar como profesor</a></div>
      </div>
    </header>
    <main v-if="loading" class="mx-auto max-w-6xl p-8"><p class="text-sm text-muted">Preparando el catálogo...</p></main>
    <main v-else-if="error" class="mx-auto max-w-3xl p-8"><h1 class="text-2xl font-extrabold">Catálogo no disponible</h1><p class="mt-3 text-sm text-muted">{{ error }}</p><a href="/" class="mt-6 inline-block text-sm font-bold text-violet-600">Volver a AcademyOS</a></main>
    <main v-else-if="academy" class="mx-auto max-w-6xl px-5 py-10 sm:py-16">
      <div class="rounded-3xl p-8 text-white sm:p-14" :style="{background:academy.brandColor}">
        <div class="flex size-20 items-center justify-center rounded-2xl bg-white/20 p-2">
          <img v-if="academy.logoUrl" :src="academy.logoUrl" :alt="'Logo de '+academy.name" class="max-h-full max-w-full object-contain" referrerpolicy="no-referrer"/>
          <GraduationCap v-else :size="28"/>
        </div>
        <p class="mt-8 text-xs font-extrabold uppercase tracking-widest text-white/75">Tu aprendizaje empieza aquí</p>
        <h1 class="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">{{ academy.name }}</h1>
        <p class="mt-5 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">{{ academy.description || 'Clases y experiencias educativas adaptadas a tu ritmo. Conoce nuestros programas y encuentra tu próximo aprendizaje.' }}</p>
        <a v-if="academy.contactUrl" :href="academy.contactUrl" target="_blank" rel="noopener noreferrer" class="mt-8 inline-flex items-center gap-2 rounded-xl bg-surface px-5 py-3 text-xs font-extrabold" :style="{color:academy.brandColor}">Consultar disponibilidad <ArrowUpRight :size="16"/></a>
      </div>
      <div class="mt-11 flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-widest text-violet-600">Clases y servicios</p><h2 class="mt-2 text-2xl font-extrabold">Aprende a tu manera</h2></div><p class="text-xs text-muted">Precios orientativos en pesos colombianos</p></div>
      <div v-if="!academy.offerings.length" class="mt-5 rounded-2xl border border-outline bg-surface p-8 text-sm text-muted">Pronto encontrarás aquí los programas disponibles.</div>
      <div v-else class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UiCard v-for="offer in academy.offerings" :key="offer.id" class="flex flex-col">
          <p class="text-xs font-bold text-violet-600">{{ offer.course?.subject?.name || 'Aprendizaje personalizado' }}</p>
          <h3 class="mt-3 text-lg font-extrabold">{{ offer.title }}</h3>
          <p class="mt-3 flex-1 text-sm leading-6 text-muted">{{ offer.description || 'Una experiencia de aprendizaje creada para ti.' }}</p>
          <div class="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted"><span class="inline-flex items-center gap-1"><Clock3 :size="14"/> {{ offer.durationMinutes }} minutos</span><span class="inline-flex items-center gap-1"><Video v-if="offer.mode==='ONLINE'" :size="14"/><MapPin v-else-if="offer.mode==='ONSITE'" :size="14"/><BookOpen v-else :size="14"/>{{ offer.mode==='ONLINE'?'Virtual':offer.mode==='ONSITE'?'Presencial':'Híbrida' }}</span></div>
          <div class="mt-6 flex items-end justify-between gap-3 border-t border-outline pt-5"><div><p class="text-xs text-muted">Precio por servicio</p><p class="mt-1 text-xl font-extrabold">{{ currency(offer.priceCOP) }}</p></div><a v-if="academy.contactUrl" :href="academy.contactUrl" target="_blank" rel="noopener noreferrer" class="rounded-xl px-4 py-3 text-xs font-extrabold text-white" :style="{background:academy.brandColor}">Consultar <ArrowUpRight :size="14" class="inline"/></a><span v-else class="text-xs text-muted">Consulta al docente</span></div>
        </UiCard>
      </div>
      <p class="mt-12 text-center text-xs text-muted">Publicado con AcademyOS · Los pagos y reservas online aún no están habilitados en este catálogo.</p>
    </main>
  </div>
</template>
