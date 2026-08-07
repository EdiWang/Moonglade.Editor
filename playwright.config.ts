import { defineConfig } from '@playwright/test';

const demoPort = Number(process.env.MOONGLADE_EDITOR_DEMO_PORT ?? 6173);
const demoBaseUrl = process.env.MOONGLADE_EDITOR_DEMO_BASE_URL ?? `http://127.0.0.1:${demoPort}`;

export default defineConfig({
  testDir: './test/playwright',
  testMatch: '**/*.smoke.ts',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: demoBaseUrl,
    trace: 'retain-on-failure',
    viewport: {
      width: 1280,
      height: 900
    }
  },
  webServer: process.env.MOONGLADE_EDITOR_DEMO_BASE_URL
    ? undefined
    : {
        command: `npm run demo:upload -- --port ${demoPort}`,
        url: `${demoBaseUrl}/demo/`,
        reuseExistingServer: !process.env.CI,
        timeout: 15_000,
        stdout: 'pipe',
        stderr: 'pipe'
      }
});
