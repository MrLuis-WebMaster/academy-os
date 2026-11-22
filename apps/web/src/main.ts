import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import AuthGate from './components/AuthGate.vue';
import './styles.css';

createApp(AuthGate).use(createPinia()).use(VueQueryPlugin).mount('#app');
