import { createAuthClient } from 'better-auth/vue';

// Same-origin on localhost through Vite /api proxy. Also works with production reverse proxy.
export const authClient = createAuthClient({ baseURL: window.location.origin });
