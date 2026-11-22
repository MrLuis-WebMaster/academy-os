# AcademyOS Design System

El sistema visual compartido vive en `packages/ui` y se importa mediante **`@academy-os/ui`** desde la aplicación Vue. Es un workspace de pnpm, con componentes reales, no estilos copiados.

## Apariencia

- **Claro**: selección explícita.
- **Oscuro**: selección explícita.
- **Sistema**: sincroniza con `prefers-color-scheme` y cambia si el dispositivo cambia.
- Estado compartido y persistencia en `localStorage` (`academy-os:appearance`). La preferencia nunca contiene información privada.
- `html[data-theme]` usa tokens semánticos integrados con Tailwind CSS 4 mediante `@theme inline`.
- Branding por academia: variable `--ao-brand-override` solo con hex válido; el resto de superficies siguen siendo semánticas y compatibles con dark mode.
- Contraste, foco con teclado y `prefers-reduced-motion` son parte de la base visual.

## Tokens y uso

Priorizar `bg-canvas`, `bg-surface`, `bg-surface-muted`, `bg-brand-soft`, `text-ink`, `text-muted`, `text-brand`, `border-outline`, `text-success`, `text-danger` y equivalentes semánticos. **No introducir colores hex directos en pantallas nuevas.**

## Componentes reutilizables

| Componente | Propósito |
|---|---|
| `UiButton` | Principal/secundario/ghost/danger, tamaños, loading, disabled |
| `UiCard` | Superficies, relleno, header/footer por slots |
| `UiField`, `UiInput`, `UiSelect`, `UiTextarea` | Formularios consistentes y accesibles con `v-model` |
| `UiSwitch` | Toggle con role=switch y aria-checked |
| `UiDialog` | `<dialog>` nativo y cierre con Escape |
| `UiBadge`, `UiAlert` | Estados por significado |
| `UiEmptyState`, `UiSkeleton` | Listas vacías y carga |
| `UiThemeSwitcher` | Claro/Oscuro/Sistema |
| `UiBrand` | Logotipo común con icono Lucide |

Todos usan **Lucide** como única familia de iconos. Los componentes primitivos no ejecutan llamadas de red, consultan sesiones ni conocen roles de academias.

## Ejemplo

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { UiButton, UiField, UiInput, UiCard } from '@academy-os/ui';
const name = ref('');
</script>
<template>
  <UiCard>
    <UiField for="academy-name" label="Academia">
      <UiInput id="academy-name" v-model="name" />
    </UiField>
    <UiButton :disabled="!name.trim()" class="mt-4">Guardar</UiButton>
  </UiCard>
</template>
```

## Gallery local

Ejecutar `pnpm dev` y entrar a **http://localhost:5173/?design-system=1**. La galería solo se habilita durante desarrollo con Vite; permite comparar estados, variantes y temas sin iniciar sesión con Google.

## Regla de implementación

Antes de crear un input, modal, button, badge o alert en una pantalla: comprobar si existe el primitivo en `@academy-os/ui`. Los componentes propios del negocio permanecen en las apps y se componen a partir de estos primitivos. Cada componente nuevo debe funcionar con teclado, teléfono, escritorio y temas claro/oscuro/automático. Las pruebas visuales automatizadas y los flujos E2E aún están pendientes.
