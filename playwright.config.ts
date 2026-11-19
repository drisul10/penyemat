import { defineConfig } from '@playwright/test';

// Chromium e2e against the e2e build in .output-e2e (see wxt.config.ts). Firefox runs in tests/e2e/firefox.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
});
