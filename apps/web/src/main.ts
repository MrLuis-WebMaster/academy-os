import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import AuthGate from './components/AuthGate.vue';
import PublicStorefront from './components/PublicStorefront.vue';
import DesignSystemPreview from './components/DesignSystemPreview.vue';
import './styles.css';
import { initializeTheme } from '@academy-os/ui';

initializeTheme();

// Canonical isolated install URL per academy; legacy ?academy= links still work.
const routeSlug=window.location.pathname.match(/^\/academy\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/)?.[1];
const slug = routeSlug || new URLSearchParams(window.location.search).get('academy');
const preview=import.meta.env.DEV && new URLSearchParams(window.location.search).has('design-system');
const app=preview?createApp(DesignSystemPreview):slug?createApp(PublicStorefront,{slug}):createApp(AuthGate);
app.use(createPinia()).use(VueQueryPlugin).mount('#app');

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/service-worker.js').catch(() => {}); });
}
