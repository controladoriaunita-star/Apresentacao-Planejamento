/**
 * v25: "Exportar PDF" da apresentação Cliente (Dev e Planejamento). Roda depois do 01 e do 02 (Dev e Viewer
 * criados; Residencial Alpha marcada com Segurança do Trabalho no Cliente).
 * A impressão do navegador é trocada por um marcador: o documento montado fica na página para conferir e
 * o PDF é gerado pelo próprio Edge (page.pdf, que usa as regras de impressão e @page).
 */
const { DEV, entrar, expect, test, VIEWER } = require('./fixture.cjs');

/** Envia uma imagem PNG e cadastra a mídia da obra no mês (destino padrão: Obra e Cliente). */
const cadastrarImagem = (page, midia) => page.evaluate(async (m) => {
  const png = await new Promise((r) => { const c = document.createElement('canvas'); c.width = 320; c.height = 180; c.getContext('2d').fillRect(0, 0, 320, 180); c.toBlob(r, 'image/png'); });
  const a = await (await fetch('/api/arquivos', { method: 'POST', headers: { 'x-requested-with': 'fetch', 'content-type': 'image/png' }, body: png })).json();
  await fetch('/api/midias', { method: 'POST', headers: { 'x-requested-with': 'fetch', 'content-type': 'application/json' }, body: JSON.stringify({ ...m, arquivoId: a.id }) });
}, midia);

test('Exportar PDF: monta as seções do Cliente da obra, gráficos em imagem e os resumos em uma página cada', async ({ page }) => {
  await page.addInitScript(() => { window.print = () => { window.__impressoes = (window.__impressoes ?? 0) + 1; }; });
  await entrar(page, DEV);
  await cadastrarImagem(page, { tipo: 'txc', obra: 'Residencial Alpha', mes: '2026-03', grupo: 'Torre PDF', comentario: 'Linha de balanço da torre' });

  // Só na apresentação Cliente
  await page.goto('/#/obra/resumo-geral');
  await expect(page.locator('[data-teste="exportar-pdf"]')).toHaveCount(0);
  await page.goto('/#/cliente/inicio');
  await page.locator('[data-teste="exportar-pdf"]').click();

  const modal = page.getByRole('dialog', { name: /Exportar PDF/ });
  await modal.getByLabel('Obra').selectOption({ label: 'Residencial Alpha' });
  const secoes = modal.getByRole('group', { name: 'Seções do PDF' });
  // Capa, as abas do Cliente (Segurança porque a Alpha foi marcada no 02) e as telas extras do Cliente (01).
  const rotulos = await secoes.locator('label').allTextContents();
  expect(rotulos.slice(0, 7)).toEqual(['Capa', 'Resumo Geral', 'Resumo Físico', 'Resumo Econômico', 'Tempo x Caminho', 'Acompanhamento Fotográfico', 'Segurança do Trabalho']);
  expect(rotulos).toContain('Marcos do cliente');
  expect(rotulos).not.toContain('Equipe interna'); // tela só da apresentação Obra
  await expect(secoes.getByRole('checkbox', { checked: false })).toHaveCount(0); // tudo marcado por padrão
  await secoes.getByLabel('Acompanhamento Fotográfico').uncheck();
  await modal.getByRole('button', { name: 'Gerar PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__impressoes ?? 0), { timeout: 60000 }).toBe(1);

  const doc = page.locator('[data-teste="impressao"]');
  const ids = await doc.locator(':scope > section').evaluateAll((s) => s.map((e) => e.dataset.secao));
  expect(ids.slice(0, 6)).toEqual(['capa', 'resumo-geral', 'resumo-fisico', 'resumo-economico', 'tempo-caminho', 'seguranca-trabalho']);
  expect(ids.slice(6).length).toBe(rotulos.length - 7); // telas extras; fotos desmarcadas ficam fora
  expect(ids.slice(6).every((id) => id.startsWith('tela-'))).toBe(true);
  await expect(doc.locator('[data-secao="fotos"]')).toHaveCount(0);
  // capa com a obra e o sumário das seções
  await expect(doc.locator('.imp-capa h1')).toHaveText('Residencial Alpha');
  await expect(doc.locator('.imp-capa-sumario li')).toHaveCount(ids.length - 1);
  // nada interativo; gráficos viram imagens
  await expect(doc.locator('canvas')).toHaveCount(0);
  expect(await doc.locator('img.imp-grafico').count()).toBeGreaterThanOrEqual(4); // 3 do Resumo Geral + Segurança
  await expect(doc.locator('button:visible')).toHaveCount(0);
  // competência e obra só no cabeçalho da página: sem o selo nas seções e sem o título repetido no Resumo Geral
  await expect(doc.locator('[data-teste="competencia"]:visible')).toHaveCount(0);
  await expect(doc.locator('[data-secao="resumo-geral"] .rg-titulo')).toBeHidden();
  // Físico e Econômico como abrem na tela: só os itens principais
  await expect(doc.locator('[data-secao="resumo-fisico"] tr', { hasText: 'Estrutura/Viga/Lajes' })).toBeHidden();
  await expect(doc.locator('[data-secao="resumo-fisico"] tr', { hasText: 'Estrutura' }).first()).toBeVisible();
  await expect(doc.locator('[data-secao="resumo-economico"] tr.detalhe:visible')).toHaveCount(0);
  // Resumo Geral, Físico e Econômico: cada um inteiro numa página (largura e altura útil da A4 paisagem), com a
  // menor redução; no Resumo Geral nenhum quadro de valores fica cortado.
  const medidas = await doc.evaluate((d) => ['resumo-geral', 'resumo-fisico', 'resumo-economico'].map((id) => {
    const alvo = d.querySelector(`[data-secao="${id}"] > div`);
    const zoom = Number(alvo.style.zoom);
    return { id, zoom, largura: alvo.offsetWidth * zoom, altura: alvo.scrollHeight * zoom };
  }));
  const mm = 96 / 25.4;
  for (const m of medidas) {
    expect(m.zoom, m.id).toBeGreaterThan(0.3);
    expect(m.zoom, m.id).toBeLessThanOrEqual(1.2); // tabela pequena pode ser ampliada para ocupar a página
    expect(m.largura, m.id).toBeLessThanOrEqual(277 * mm + 1);
    expect(m.altura, m.id).toBeLessThanOrEqual(183 * mm);
  }
  expect(await doc.locator('[data-secao="resumo-geral"] .rg-cartao:not(.rg-grafico)').evaluateAll((cs) => cs
    .filter((c) => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1).map((c) => c.dataset.quadro))).toEqual([]);
  // TxC: a imagem do mês com torre e comentário
  await expect(doc.locator('[data-secao="tempo-caminho"] figure')).toContainText('Torre PDF');
  await expect(doc.locator('[data-secao="tempo-caminho"] figure')).toContainText('Linha de balanço da torre');
  // cabeçalho/rodapé da página e nome sugerido do arquivo
  const regras = await page.locator('#impressao-pagina').textContent();
  expect(regras).toContain('size: A4 landscape');
  expect(regras).toContain('Residencial Alpha');
  expect(regras).toContain('counter(pages)');
  await expect(page).toHaveTitle(/^Unità - Residencial Alpha - Apresentação ao cliente - \d{4}-\d{2}$/);

  // O PDF de verdade, gerado pelo Edge com as regras de impressão: várias páginas, uma por seção ao menos.
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(paginas).toBeGreaterThanOrEqual(7);

  // Depois de imprimir (ou cancelar), o documento some e o título volta.
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(doc).toHaveCount(0);
  await expect(page).toHaveTitle(/Planejamento e Controle/);
});

test('Exportar PDF não aparece para o Viewer', async ({ page }) => {
  await entrar(page, VIEWER);
  await page.goto('/#/cliente/inicio');
  await expect(page.getByText('Avanço físico realizado')).toBeVisible();
  await expect(page.locator('[data-teste="exportar-pdf"]')).toHaveCount(0);
});
