let counter = 0;
/** Unique id that works in non-secure contexts too (e.g. LAN access from a tablet). */
export function uid(): string {
  counter = (counter + 1) % 1e6;
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + counter.toString(36);
}

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** yyyy-mm-dd -> dd/mm/yyyy. Any other text is returned unchanged. */
export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value.trim();
}

export function sanitizeFilename(s: string, maxLen = 60): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[_.]+|[_.]+$/g, '')
      .slice(0, maxLen) || 'photo'
  );
}

export function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

/** Increment the last number found in a reference, keeping zero padding: V-101 -> V-102, P009 -> P010. */
export function incrementRef(ref: string, step: number): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(ref);
  if (!m) return step === 0 ? ref : `${ref}-${step + 1}`;
  const n = parseInt(m[2], 10) + step;
  const padded = String(Math.max(0, n)).padStart(m[2].length, '0');
  return `${m[1]}${padded}${m[3]}`;
}
