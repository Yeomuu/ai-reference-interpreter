/** Keep automatically assigned names distinct without changing names already saved. */
export function displayName(existing: string[], requested: string, fallback: string): string {
  const base = requested.trim() || fallback;
  if (requested.trim() && !existing.includes(base)) return base;
  let number = 1;
  while (existing.includes(`${base} (${number})`)) number += 1;
  return `${base} (${number})`;
}
