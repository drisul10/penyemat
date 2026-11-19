import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// Permissions follow ARCHITECTURE.md section 3. Widening them needs the owner's approval.
// PENYEMAT_E2E builds a separate test copy that already holds host access, because automation
// can't click the toolbar button (activeTab) or answer the optional-permission prompt.
const e2e = process.env.PENYEMAT_E2E === '1';

export default defineConfig({
  srcDir: 'src',
  outDir: e2e ? '.output-e2e' : '.output',
  modules: ['@wxt-dev/module-svelte'],
  imports: false,
  manifestVersion: 3,
  vite: () => ({
    plugins: [tailwindcss()],
    worker: { format: 'es' },
  }),
  manifest: ({ browser }) => ({
    name: 'Penyemat',
    description: 'Save a page in one click and find it again by any word on it.',
    // downloads + alarms: Autosave (owner approved 2026-11-19, "Add both").
    permissions: ['activeTab', 'scripting', 'storage', 'unlimitedStorage', 'contextMenus', 'downloads', 'alarms'],
    optional_host_permissions: ['<all_urls>'],
    ...(e2e ? { host_permissions: ['<all_urls>'] } : {}),
    action: { default_title: 'Save to Penyemat' },
    commands: {
      'save-to-locked': { description: 'Save to Locked' },
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: { id: 'penyemat@example.com', strict_min_version: '128.0' },
          },
        }
      : {}),
  }),
});
