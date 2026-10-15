/**
 * Fixture: qualquer erro de JavaScript, console.error ou resposta 5xx reprova o teste.
 */
const { test: base, expect } = require('@playwright/test');

const DEV = { nome: 'Dev E2E', email: 'dev@e2e.test', senha: 'senha-e2e-123' };
const VIEWER = { nome: 'Viewer E2E', email: 'viewer@e2e.test', senha: 'senha-e2e-456' };

const test = base.extend({
  page: async ({ page }, use) => {
    const problemas = [];
    page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problemas.push(`console: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 500) problemas.push(`HTTP ${r.status()} ${r.url()}`); });
    await use(page);
    expect(problemas, problemas.join('\n')).toEqual([]);
  },
});

async function entrar(page, { email, senha }) {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('navigation', { name: 'Abas da apresentação' })).toBeVisible();
}

module.exports = { DEV, VIEWER, test, entrar, expect };
