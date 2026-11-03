import { defineConfig, devices } from "@playwright/test";

// CI runs the three engines bundled with Playwright. Locally, when those engines are not
// available for the OS, PW_LOCAL_CHROME=1 runs the suite on the installed Google Chrome.
const localChrome = process.env.PW_LOCAL_CHROME === "1";

export default defineConfig({
  testDir: "test/browser",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure" },
  projects: localChrome
    ? [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }]
    : [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
      ],
});
