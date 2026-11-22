<script setup lang="ts">
import {ref} from 'vue';
import {BookOpen,CheckCircle2,GraduationCap,Plus,ShieldCheck} from 'lucide-vue-next';
import {
  UiAlert,UiBadge,UiBrand,UiButton,UiCard,UiDialog,UiEmptyState,
  UiField,UiInput,UiSelect,UiSkeleton,UiSwitch,UiTextarea,UiThemeSwitcher,
} from '@academy-os/ui';
const academyName=ref('Mi academia'),subject=ref('math'),notes=ref(''),enabled=ref(true),open=ref(false);
const busy=ref(false);
</script>
<template>
  <div class="min-h-screen bg-canvas p-5 text-ink md:p-10">
    <div class="mx-auto max-w-6xl">
      <header class="flex flex-wrap items-center justify-between gap-4 border-b border-outline pb-6">
        <div><UiBrand/><p class="mt-2 text-xs text-muted">AcademyOS Design System · Vista local de desarrollo</p></div>
        <UiThemeSwitcher/>
      </header>
      <div class="mt-10 flex flex-wrap items-center justify-between gap-5"><div><p class="text-xs font-bold uppercase tracking-widest text-brand">Componentes primitivos</p><h1 class="mt-2 text-3xl font-extrabold">Construir una vez, reutilizar siempre</h1><p class="mt-2 max-w-2xl text-sm leading-6 text-muted">Una sola fuente para tipografía, superficies, estados, inputs, iconos y temas. Cambia entre Claro, Oscuro y Sistema para probar la consistencia.</p></div><UiBadge tone="success"><CheckCircle2 :size="14"/> UI compartida</UiBadge></div>
      <div class="mt-7 grid gap-5 lg:grid-cols-2">
        <UiCard>
          <template #header><h2 class="text-lg font-bold">Botones y badges</h2><p class="mt-1 text-xs text-muted">Variantes que consumen tokens semánticos</p></template>
          <div class="flex flex-wrap gap-3">
            <UiButton><Plus :size="17"/> Acción principal</UiButton>
            <UiButton variant="secondary">Secundario</UiButton>
            <UiButton variant="ghost">Discreto</UiButton>
            <UiButton variant="danger">Eliminar</UiButton>
            <UiButton :loading="true">Procesando</UiButton>
          </div>
          <div class="mt-6 flex flex-wrap gap-2">
            <UiBadge>Neutral</UiBadge><UiBadge tone="brand">En progreso</UiBadge><UiBadge tone="success">Publicado</UiBadge><UiBadge tone="warning">Pendiente</UiBadge><UiBadge tone="danger">Error</UiBadge>
          </div>
        </UiCard>
        <UiCard>
          <template #header><h2 class="text-lg font-bold">Formularios</h2><p class="mt-1 text-xs text-muted">Labels, estados, descripciones y accesibilidad</p></template>
          <div class="grid gap-4">
            <UiField label="Nombre de la academia" for="preview-name" hint="Visible para tus alumnos" required><UiInput id="preview-name" v-model="academyName" required placeholder="Nombre público"/></UiField>
            <UiField label="Materia" for="preview-subject"><UiSelect id="preview-subject" v-model="subject"><option value="math">Matemáticas</option><option value="english">Inglés</option><option value="science">Ciencias</option></UiSelect></UiField>
            <UiField label="Observaciones" for="preview-notes"><UiTextarea id="preview-notes" v-model="notes" :rows="2" placeholder="Escribe una observación..."/></UiField>
            <UiSwitch v-model="enabled" label="Catálogo publicado" description="Controla la visibilidad de tu página."/>
          </div>
        </UiCard>
        <UiCard>
          <template #header><h2 class="text-lg font-bold">Alertas y estados</h2></template>
          <div class="grid gap-3">
            <UiAlert title="Acceso seguro">Tu espacio está separado de otras academias.</UiAlert>
            <UiAlert tone="success" title="Cambios guardados">Puedes continuar con la siguiente clase.</UiAlert>
            <UiAlert tone="warning">Revisa la configuración de la pasarela.</UiAlert>
            <UiAlert tone="danger">No fue posible completar la acción.</UiAlert>
          </div>
        </UiCard>
        <UiCard>
          <template #header><h2 class="text-lg font-bold">Estados vacíos y diálogos</h2></template>
          <UiEmptyState title="Aún no tienes materias" description="Agrega tu primera materia para empezar."><template #icon><BookOpen :size="25"/></template><template #actions><UiButton size="sm" @click="open=true"><Plus :size="14"/> Nueva materia</UiButton></template></UiEmptyState>
          <div class="mt-5 space-y-3"><UiSkeleton height="1.25rem" width="55%"/><UiSkeleton height="1.25rem" width="85%"/></div>
        </UiCard>
      </div>
      <footer class="mt-10 text-center text-xs text-muted">Lucide icons · Semántica accesible · Responsive · Reducir movimiento · Tema automático</footer>
    </div>
    <UiDialog v-model:open="open" title="Nueva materia" description="Ejemplo de diálogo nativo, accesible y reutilizable.">
      <UiField label="Nombre de materia" for="preview-new-subject"><UiInput id="preview-new-subject" v-model="subject" placeholder="Ej. Música"/></UiField>
      <div class="mt-5 flex justify-end"><UiButton @click="open=false"><ShieldCheck :size="16"/> Cerrar demostración</UiButton></div>
    </UiDialog>
  </div>
</template>
