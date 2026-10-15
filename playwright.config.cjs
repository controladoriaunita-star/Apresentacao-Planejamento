/**
 * Testes de tela (regressão visual-funcional) contra o servidor real em modo exemplo, com pasta de
 * dados descartável. Em CommonJS (.cjs): o carregador ESM do Playwright trava com acentos no
 * caminho da pasta ("Apresentação") no Windows. Usa o Edge instalado no Windows (channel msedge) — nada é baixado.
 */
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5299', channel: 'msedge', viewport: { width: 1600, height: 1000 }, locale: 'pt-BR' },
  webServer: {
    command: 'node tests/e2e/servidor-e2e.mjs',
    url: 'http://127.0.0.1:5299/api/saude',
    reuseExistingServer: false,
    env: { STORE: 'local', DATA_SOURCE: 'exemplo', DATA_DIR: './data/e2e', PORT: '5299', INCC_ONLINE: 'false', SESSION_SECRET: 'e2e' },
  },
});
