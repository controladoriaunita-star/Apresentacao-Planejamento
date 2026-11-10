/**
 * v26: Dev libera para um Viewer só uma obra e só a apresentação Cliente (Administração → Usuários); o Viewer
 * entra direto no Cliente, sem o seletor Obra/Cliente, e o filtro de obras só tem a obra liberada.
 * Roda depois do 01 (Dev já criado).
 */
const { DEV, entrar, expect, test } = require('./fixture.cjs');

const RESTRITO = { nome: 'Restrito E2E', email: 'restrito@e2e.test', senha: 'senha-e2e-321' };

test('Viewer restrito por obra e por apresentação só vê o que foi liberado', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/admin/usuarios');
  await page.getByRole('button', { name: 'Novo usuário' }).click();
  const modal = page.getByRole('dialog');
  const acesso = modal.getByRole('group', { name: 'Acesso do Viewer' });
  await modal.getByLabel('Nome').fill(RESTRITO.nome);
  await modal.getByLabel('E-mail').fill(RESTRITO.email);
  await modal.getByLabel('Papel').selectOption('planejamento');
  await expect(acesso).toBeHidden(); // só o Viewer é restrito
  await modal.getByLabel('Papel').selectOption('viewer');
  await expect(acesso).toBeVisible();
  await expect(modal.getByRole('group', { name: 'Obras liberadas' })).toBeHidden(); // padrão: todas as obras
  await acesso.getByRole('combobox', { name: 'Apresentação' }).selectOption('cliente');
  await acesso.getByLabel('Somente as obras selecionadas').check();
  await modal.getByRole('group', { name: 'Obras liberadas' }).getByRole('checkbox', { name: 'Residencial Alpha' }).check();
  await modal.getByLabel('Senha inicial').fill(RESTRITO.senha);
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('row', { name: /Restrito E2E/ })).toContainText('1 obra · Somente Cliente');

  await page.getByRole('button', { name: 'Sair' }).click();
  await entrar(page, RESTRITO);
  await expect(page).toHaveURL(/#\/cliente\/inicio$/);
  await expect(page.getByRole('group', { name: 'Apresentação' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Residencial Alpha' })).toBeVisible();

  // Rota direta da apresentação Obra leva à mesma aba no Cliente; o filtro só tem a obra liberada.
  await page.goto('/#/obra/resumo-geral');
  await expect(page).toHaveURL(/#\/cliente\/resumo-geral$/);
  await page.locator('[data-teste="filtro-obras"]').click();
  await expect(page.getByRole('dialog').getByText('Residencial Alpha')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Edifício Beta')).toHaveCount(0);
  await expect(page.getByRole('dialog').getByText('1 de 1')).toBeVisible();
});
