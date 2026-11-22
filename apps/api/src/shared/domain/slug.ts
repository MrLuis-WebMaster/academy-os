/**
 * Shared-kernel value normalization: framework-agnostic and deterministic.
 * Only domain and application modules depend on this function.
 */
export function slugify(value: string): string {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/, '');
}
