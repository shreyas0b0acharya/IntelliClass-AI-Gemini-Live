import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60000,
  expect: {
    timeout: 12000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "https://localhost:3000",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--allow-file-access",
        "--ignore-certificate-errors",
      ],
    },
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*auth\.setup\.ts/,
    },
    {
      name: "chromium",
      testMatch: /tests\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["microphone", "camera"],
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: process.env.PLAYWRIGHT_TEST_BASE_URL || "https://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
    ignoreHTTPSErrors: true,
  },
});
