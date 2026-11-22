import { defineConfig, devices } from "@playwright/test"

const port = 4317
const channel = process.env["PLAYWRIGHT_CHANNEL"]

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, ...(channel ? { channel } : {}) },
  webServer: { command: `pnpm exec vite preview --port ${port} --strictPort`, port, reuseExistingServer: !process.env["CI"] },
  projects: [
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "landscape", use: { ...devices["Desktop Chrome"], viewport: { width: 1180, height: 820 }, hasTouch: true } }
  ]
})
