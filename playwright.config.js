// Testes automáticos (npm test). Usam o Chrome instalado no computador e servem dist/famosodle
// com os mesmos cabeçalhos do vercel.json, pelo scripts/servir.js. Sem Chrome instalado, rode
// npx playwright install chromium e defina a variável PW_CHROMIUM=1.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "testes",
  timeout: 90000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.PW_CHROMIUM ? undefined : "chrome",
    headless: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    serviceWorkers: "block"
  },
  webServer: {
    command: "node scripts/servir.js dist/famosodle 4173",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: false,
    timeout: 20000
  }
});
