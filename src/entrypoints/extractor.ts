import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { extractFromDocument } from '../lib/extract/readable';

// Injected into the current tab only on a save (activeTab + scripting, ARCHITECTURE 2).
// Defines a function the background calls right after, in the same isolated world.

export default defineUnlistedScript(() => {
  (globalThis as unknown as { __penyematExtract: () => unknown }).__penyematExtract = () => {
    // biome-ignore lint/performance/useDomNodeTextContent: the fallback is the visible text (ARCHITECTURE 5.1), which only innerText gives.
    const visible = document.body?.innerText ?? '';
    const result = extractFromDocument(document, visible);
    return { ...result, contentType: document.contentType };
  };
});
