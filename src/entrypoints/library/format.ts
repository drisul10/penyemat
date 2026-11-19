// Dates and short labels shown in the library.

const DAY = 24 * 60 * 60 * 1000;

export function shortDate(time: number, now = Date.now()): string {
  const date = new Date(time);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - new Date(date).setHours(0, 0, 0, 0);
  if (diff <= 0) return 'Today';
  if (diff <= DAY) return 'Yesterday';
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(
    'en-GB',
    sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' },
  );
}

/** Titles in toasts are cut at 40 characters (design.html Toast). */
export function cut(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
