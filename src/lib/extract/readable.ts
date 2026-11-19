import { Readability } from '@mozilla/readability';
import { capText, cleanText } from './limits';

export interface Extracted {
  title: string;
  text: string;
  favicon: string;
}

/**
 * Runs Readability on a document and falls back to the visible body text.
 * Used in the page (toolbar save) and on a parsed document (pasted link).
 * The document is cloned because Readability changes the DOM it reads.
 */
export function extractFromDocument(doc: Document, fallbackText?: string): Extracted {
  const title = (doc.title || '').trim();
  let text = '';
  try {
    const article = new Readability(doc.cloneNode(true) as Document).parse();
    text = article?.textContent ?? '';
  } catch {
    text = '';
  }
  if (!text.trim()) text = fallbackText ?? doc.body?.textContent ?? '';
  return { title, text: capText(cleanText(text)), favicon: findInlineFavicon(doc) };
}

/**
 * Only data: favicons are kept. Loading a remote favicon later would be a third-party
 * request (AGENTS.md hard rule 2), so other pages get a letter tile instead.
 */
function findInlineFavicon(doc: Document): string {
  const links = doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
  for (const link of links) {
    const href = link.getAttribute('href') ?? '';
    if (href.startsWith('data:image/') && href.length < 8192) return href;
  }
  return '';
}
