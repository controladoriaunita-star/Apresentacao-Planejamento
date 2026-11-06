/**
 * v23: aba Segurança do Trabalho (padrão na Obra, opcional por obra no Cliente), papel Segurança e envio de
 * imagens em qualquer formato (convertidas para PNG/JPG no navegador). Roda depois do 01 (Dev já criado).
 */
const path = require('node:path');
const { DEV, entrar, expect, test } = require('./fixture.cjs');

const SEGURANCA = { nome: 'Segurança E2E', email: 'seguranca@e2e.test', senha: 'senha-e2e-789' };
const IMAGENS = path.join(__dirname, '..', 'fixtures', 'imagens');

/** Grava o cadastro da obra pela API (PUT substitui o cadastro inteiro). */
const salvarCadastro = (page, campos) => page.evaluate((c) => fetch('/api/obras/cadastro', {
  method: 'PUT', headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' }, body: JSON.stringify(c),
}).then((r) => r.status), campos);

const ALPHA = { obra: 'Residencial Alpha', cliente: 'Cliente XPTO', sistemaEstrutural: 'Parede de concreto' };

async function filtrarAlpha(page) {
  await page.locator('[data-teste="filtro-obras"]').click();
  await page.getByRole('searchbox', { name: 'Pesquisar' }).fill('alpha');
  await page.getByLabel('(Selecionar todos os resultados)').check();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
}

test('Segurança do Trabalho: sempre na Obra; no Cliente só para obras marcadas no cadastro', async ({ page }) => {
  await entrar(page, DEV);
  expect(await salvarCadastro(page, ALPHA)).toBe(200);
  await page.reload(); // o cadastro vem junto com os dados, carregados ao abrir o app
  const menu = page.getByRole('navigation', { name: 'Abas da apresentação' });

  await page.goto('/#/obra/seguranca-trabalho');
  await filtrarAlpha(page);
  await expect(page.getByRole('heading', { name: /Segurança do Trabalho/ })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Segurança do Trabalho' })).toBeVisible();

  // Cliente: desligada por padrão — sem link no menu, nem atalho na capa; a rota volta para a capa.
  await page.goto('/#/cliente/resumo-fisico');
  await expect(menu.getByRole('link', { name: 'Resumo Físico' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Segurança do Trabalho' })).toHaveCount(0);
  await page.goto('/#/cliente/seguranca-trabalho');
  await expect(page).toHaveURL(/#\/cliente\/inicio$/);
  await expect(page.getByRole('navigation', { name: 'Atalhos' }).getByText('Segurança do Trabalho')).toHaveCount(0);

  // Marca a obra no Cadastro de obras (campo novo, grupo "Apresentação").
  await page.goto('/#/admin/cadastro-obras');
  await page.getByRole('row', { name: /Residencial Alpha/ }).getByRole('button', { name: 'Editar' }).click();
  const campo = page.getByRole('dialog').getByRole('combobox', { name: 'Segurança do Trabalho na apresentação Cliente' });
  await expect(campo).toHaveValue('');
  await campo.selectOption('sim');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.reload();
  await page.goto('/#/cliente/inicio');
  await expect(page.getByRole('navigation', { name: 'Atalhos' }).getByText('Segurança do Trabalho')).toBeVisible();
  await menu.getByRole('link', { name: 'Segurança do Trabalho' }).click();
  await expect(page).toHaveURL(/#\/cliente\/seguranca-trabalho$/);
  await expect(page.getByRole('heading', { name: /Segurança do Trabalho/ })).toBeVisible();
  await expect(page.getByText('Nº de acidentes ocorridos no mês')).toBeVisible();
});

test('papel Segurança: entra direto na Administração → Segurança do Trabalho e não vê as apresentações', async ({ page }) => {
  await entrar(page, DEV);
  const status = await page.evaluate((u) => fetch('/api/usuarios', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' }, body: JSON.stringify({ ...u, papel: 'seguranca' }),
  }).then((r) => r.status), SEGURANCA);
  expect(status).toBe(201);
  await page.goto('/#/admin/usuarios');
  await page.getByRole('button', { name: 'Novo usuário' }).click();
  await expect(page.getByRole('dialog').getByLabel('Papel').locator('option', { hasText: 'Segurança' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Sair' }).click();

  await page.getByLabel('E-mail').fill(SEGURANCA.email);
  await page.getByLabel('Senha').fill(SEGURANCA.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/admin\/seguranca$/);
  await expect(page.getByRole('heading', { name: 'Segurança do Trabalho', exact: true })).toBeVisible();

  // Só a seção de Segurança; sem Obra/Cliente, Apresentar ou abas.
  await expect(page.getByRole('navigation', { name: 'Seções' }).getByRole('link')).toHaveText(['Segurança do Trabalho']);
  await expect(page.getByRole('group', { name: 'Apresentação' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apresentar' })).toHaveCount(0);

  // Formulário lista as obras do cadastro (via /api/seguranca/obras).
  await page.getByRole('button', { name: 'Novo acidente' }).click();
  await expect(page.getByRole('dialog').getByText('Residencial Alpha').first()).toBeAttached();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('link', { name: 'Dashboard Segurança' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard Segurança' })).toBeVisible();

  // Rotas das apresentações e das outras seções voltam para a Segurança.
  for (const rota of ['/#/obra/inicio', '/#/cliente/resumo-geral', '/#/admin/cadastro-obras', '/#/admin/usuarios']) {
    await page.goto(rota);
    await expect(page).toHaveURL(/#\/admin\/seguranca$/);
  }
  await page.goto('/#/conta');
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible();
});

test('imagens em qualquer formato: HEIC, TIFF, BMP, AVIF e SVG viram JPG/PNG; outro arquivo é recusado', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/admin/midias');
  await page.getByRole('button', { name: 'Acompanhamento fotográfico' }).click();
  await page.getByRole('button', { name: 'Cadastrar imagens' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('combobox', { name: /^Obra/ }).selectOption('Residencial Alpha');
  await modal.getByLabel('Mês').fill('2026-02');
  await modal.getByLabel('Local').fill('Formatos');

  const entrada = modal.locator('input[type=file]');
  await expect(entrada).toHaveAttribute('accept', /image\/\*.*\.heic.*\.tiff?/);
  await entrada.setInputFiles(['foto.heic', 'foto.tif', 'foto.bmp', 'foto.avif', 'logo.svg', 'nao-e-imagem.txt'].map((n) => path.join(IMAGENS, n)));
  await expect(page.getByText('"nao-e-imagem.txt" não é uma imagem.')).toBeVisible();
  const nomes = modal.locator('.arquivos-escolhidos .arquivo-nome b');
  await expect(nomes).toHaveText(['foto.jpg', 'foto.jpg', 'foto.png', 'foto.png', 'logo.png'], { timeout: 30000 });
  // miniaturas renderizam (conversão válida)
  await expect.poll(() => modal.locator('.arquivos-escolhidos img').evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0))).toBe(true);

  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('5 imagem(ns) cadastrada(s)')).toBeVisible();

  const enviados = await page.evaluate(async () => {
    const midias = await (await fetch('/api/midias?tipo=foto&mes=2026-02')).json();
    return Promise.all(midias.filter((m) => m.grupo === 'Formatos').map(async (m) => {
      const r = await fetch(`/api/arquivos/${m.arquivoId}`);
      const img = await createImageBitmap(await r.blob());
      return { tipo: r.headers.get('content-type'), largura: img.width };
    }));
  });
  expect(enviados).toHaveLength(5);
  for (const e of enviados) {
    expect(['image/jpeg', 'image/png']).toContain(e.tipo);
    expect(e.largura).toBeGreaterThan(0);
  }
});
