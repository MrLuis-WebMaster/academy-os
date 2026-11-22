import { computed, ref } from 'vue';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'academy-os:appearance';
const preference = ref<ThemePreference>('system');
const resolved = ref<ResolvedTheme>('light');
let initialized = false;

export function resolveTheme(value: ThemePreference, systemDark: boolean): ResolvedTheme {
  return value === 'system' ? (systemDark ? 'dark' : 'light') : value;
}
function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}
function apply() {
  if (typeof window === 'undefined') return;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  resolved.value = resolveTheme(preference.value, prefersDark);
  document.documentElement.setAttribute('data-theme', resolved.value);
  document.documentElement.style.colorScheme = resolved.value;
}
export function initializeTheme() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    preference.value = isPreference(value) ? value : 'system';
  } catch {
    preference.value = 'system';
  }
  apply();
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener?.('change', apply);
}
export function setTheme(next: ThemePreference) {
  if (!isPreference(next)) return;
  preference.value = next;
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(THEME_KEY, next); } catch { /* storage may be blocked */ }
    apply();
  }
}
/** The same reactive state is shared across every app and primitive. */
export function useTheme() {
  return { preference, resolved: computed(() => resolved.value), setTheme };
}
