/**
 * Placeholder substitution for prompt templates.
 *
 * Must stay free of imports: the client-side Prompt Library validator and the
 * prompt template modules both depend on it, and `@/lib/ai` is server-only.
 */

const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Replace every `{{name}}` in `template` with `vars[name]`.
 * Placeholders with no matching variable are left in place.
 */
export function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  // The replacer must be a function: with a string replacement, a `$&` or `$1`
  // occurring in a resume or job description would be treated as a substitution
  // pattern. A single pass also means a value that itself contains `{{resumeText}}`
  // is never expanded again.
  return template.replace(PLACEHOLDER_RE, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

/** The distinct placeholder names used in `template`, in order of first appearance. */
export function extractPlaceholders(template: string): string[] {
  return [
    ...new Set(Array.from(template.matchAll(PLACEHOLDER_RE), (m) => m[1])),
  ];
}
