import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import AuthGate from './components/AuthGate.vue';
import PublicStorefront from './components/PublicStorefront.vue';
import './styles.css';

const slug = new URLSearchParams(window.location.search).get('academy');
const app=slug?createApp(PublicStorefront,{slug}):createApp(AuthGate);
app.use(createPinia()).use(VueQueryPlugin).mount('#app');
