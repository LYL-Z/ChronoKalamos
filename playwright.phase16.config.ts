import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PHASE16_E2E_PORT ?? 4198);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e-live",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `powershell -ExecutionPolicy Bypass -File scripts/start-test-preview.ps1 -Port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [{ name: "phase16-live-chromium" }],
});
