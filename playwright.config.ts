import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: [
    {
      command: 'pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec vite --config web/vite.config.ts --host 127.0.0.1 --port 1701 --strictPort',
      url: 'http://127.0.0.1:1701',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    { name: 'chromium', testIgnore: /tactical\.spec\.ts/, use: { browserName: 'chromium' } },
    { name: 'firefox', testIgnore: /tactical\.spec\.ts/, use: { browserName: 'firefox' } },
    { name: 'webkit', testIgnore: /tactical\.spec\.ts/, use: { browserName: 'webkit' } },
    {
      name: 'tactical',
      testMatch: /tactical\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:1701', viewport: { width: 1280, height: 720 } },
    },
  ],
});
