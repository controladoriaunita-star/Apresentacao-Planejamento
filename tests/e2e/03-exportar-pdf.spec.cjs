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

/** v30: layout do Resumo Geral desenhado pelo Dev (diferente do padrão) — o PDF tem de sair igual. */
const LAYOUT_DEV = {
  cef: { x: 1, y: 1, w: 5, h: 12 }, economica: { x: 1, y: 13, w: 5, h: 12 }, incc: { x: 6, y: 1, w: 3, h: 9 },
  custos: { x: 6, y: 10, w: 3, h: 8 }, andamento: { x: 6, y: 18, w: 3, h: 7 }, nhnu: { x: 6, y: 18, w: 3, h: 7 },
  curva: { x: 9, y: 1, w: 16, h: 11 }, barras: { x: 9, y: 12, w: 16, h: 7 }, assertividade: { x: 9, y: 19, w: 16, h: 6 },
};
const salvarLayout = (page, layout) => page.evaluate((l) => fetch('/api/layouts/resumo-geral', {
  method: 'PUT', headers: { 'x-requested-with': 'fetch', 'content-type': 'application/json' }, body: JSON.stringify({ layout: l }),
}).then((r) => r.status), layout);

test('Exportar PDF: monta as seções do Cliente da obra, gráficos em imagem e os resumos em uma página cada', async ({ page }) => {
  await page.addInitScript(() => { window.print = () => { window.__impressoes = (window.__impressoes ?? 0) + 1; }; });
  await entrar(page, DEV);
  expect(await salvarLayout(page, LAYOUT_DEV)).toBe(200);
  await page.reload();
  await cadastrarImagem(page, { tipo: 'txc', obra: 'Residencial Alpha', mes: '2026-03', grupo: 'Torre PDF', comentario: 'Linha de balanço da torre' });

  // Só na apresentação Cliente
  await page.goto('/#/obra/resumo-geral');
  await expect(page.locator('[data-teste="exportar-pdf"]')).toHaveCount(0);
  // v30: proporção da grade do Resumo Geral na tela (o PDF tem de sair com a mesma, sem esticar na vertical)
  await expect(page.locator('.rg.rg-tela')).toBeVisible();
  const proporcaoTela = await page.locator('.rg-corpo').evaluate((c) => c.clientWidth / c.clientHeight);
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
  await expect(doc.locator('.imp-capa-kpi'), 'v32: quadros de indicadores ocultos na capa').toHaveCount(0);
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
  // v30: o Resumo Geral sai com o layout desenhado em "Editar layout" (mesma posição de cada quadro na grade)
  const posicoes = await doc.locator('[data-secao="resumo-geral"] [data-quadro]').evaluateAll((cs) => Object.fromEntries(cs.map((c) => {
    const e = getComputedStyle(c);
    return [c.dataset.quadro, [e.gridRowStart, e.gridColumnStart, e.gridRowEnd, e.gridColumnEnd].join(' ')];
  })));
  // v30: a grade do PDF tem a proporção da tela (largura ÷ altura), não a da folha
  const proporcaoPdf = await doc.locator('[data-secao="resumo-geral"] .rg').evaluate((rg) => rg.offsetWidth / rg.offsetHeight);
  expect(Math.abs(proporcaoPdf - proporcaoTela), `proporção ${proporcaoPdf.toFixed(3)} × tela ${proporcaoTela.toFixed(3)}`).toBeLessThan(0.03);
  // v30: cada gráfico (imagem) ocupa a largura inteira do seu quadro
  const graficos = await doc.locator('[data-secao="resumo-geral"] img.imp-grafico').evaluateAll((is) => is.map((i) => i.offsetWidth / i.parentElement.clientWidth));
  expect(graficos.length).toBe(3);
  for (const proporcao of graficos) expect(proporcao).toBeGreaterThan(0.97);
  for (const [id, r] of Object.entries(LAYOUT_DEV)) {
    if (id === 'nhnu') continue; // oculto por enquanto
    expect(posicoes[id], `posição de ${id} no PDF`).toBe(`${r.y} ${r.x} span ${r.h} span ${r.w}`);
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
  // v30: o Resumo Geral tem folha própria — largura da A4 paisagem e altura da grade + margens (14 + 13 mm) + 2 mm
  const ptPorMm = 72 / 25.4;
  const folhas = (pdf.toString('latin1').match(/\/MediaBox\s*\[[^\]]*\]/g) ?? []).map((m) => m.match(/[\d.]+/g).slice(2).map((v) => Number(v) / ptPorMm));
  const folhaGeral = folhas.filter(([, altura]) => altura < 208);
  expect(folhaGeral, JSON.stringify(folhas)).toHaveLength(1);
  expect(folhaGeral[0][0]).toBeCloseTo(297, 0);
  const alturaGeralMm = medidas.find((m) => m.id === 'resumo-geral').altura / mm;
  expect(Math.abs(folhaGeral[0][1] - (14 + 13 + 2 + alturaGeralMm)), `folha ${folhaGeral[0][1].toFixed(1)} mm × grade ${alturaGeralMm.toFixed(1)} mm`).toBeLessThan(1.5);
  expect(folhas.filter(([largura, altura]) => Math.abs(largura - 297) < 1 && Math.abs(altura - 210) < 1).length).toBe(folhas.length - 1); // as demais, A4 paisagem

  // Depois de imprimir (ou cancelar), o documento some e o título volta.
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(doc).toHaveCount(0);
  await expect(page).toHaveTitle(/Planejamento e Controle/);
  await page.evaluate(() => fetch('/api/layouts/resumo-geral', { method: 'PUT', headers: { 'x-requested-with': 'fetch', 'content-type': 'application/json' }, body: JSON.stringify({ layout: {} }) }));
});

/** Grava a ordem das abas do menu (Resumo Geral → "Editar layout"); lista vazia volta à ordem padrão. */
const salvarOrdemAbas = (page, ordem) => page.evaluate((o) => fetch('/api/layouts/abas', {
  method: 'PUT', headers: { 'x-requested-with': 'fetch', 'content-type': 'application/json' }, body: JSON.stringify({ ordem: o }),
}).then((r) => r.status), ordem);

test('Exportar PDF: seções e folhas na ordem das abas definida na apresentação', async ({ page }) => {
  await page.addInitScript(() => { window.print = () => { window.__impressoes = (window.__impressoes ?? 0) + 1; }; });
  await entrar(page, DEV);
  const marcos = await page.evaluate(() => fetch('/api/telas').then((r) => r.json()).then((t) => t.find((x) => x.titulo === 'Marcos do cliente').id));
  // Tela extra primeiro e o Econômico antes do Geral e do Físico; as demais seguem na ordem padrão.
  expect(await salvarOrdemAbas(page, [`tela-${marcos}`, 'resumo-economico', 'resumo-geral', 'resumo-fisico'])).toBe(200);
  try {
    await page.goto('/#/cliente/inicio');
    await page.reload();
    // o menu é redesenhado com a ordem salva quando os dados terminam de carregar
    await expect.poll(() => page.locator('nav[aria-label="Abas da apresentação"] a').evaluateAll((a) => a.slice(0, 4).map((e) => e.dataset.aba)))
      .toEqual([`tela-${marcos}`, 'resumo-economico', 'resumo-geral', 'resumo-fisico']);

    await page.locator('[data-teste="exportar-pdf"]').click();
    const modal = page.getByRole('dialog', { name: /Exportar PDF/ });
    await modal.getByLabel('Obra').selectOption({ label: 'Residencial Alpha' });
    const secoes = modal.getByRole('group', { name: 'Seções do PDF' });
    const rotulos = await secoes.locator('label').allTextContents();
    expect(rotulos.slice(0, 5)).toEqual(['Capa', 'Marcos do cliente', 'Resumo Econômico', 'Resumo Geral', 'Resumo Físico']);
    // Só as seções reordenadas, para o teste ser rápido.
    for (const nome of rotulos.slice(5)) await secoes.getByLabel(nome, { exact: true }).uncheck();
    await modal.getByRole('button', { name: 'Gerar PDF' }).click();
    await expect.poll(() => page.evaluate(() => window.__impressoes ?? 0), { timeout: 60000 }).toBe(1);

    const doc = page.locator('[data-teste="impressao"]');
    const ids = await doc.locator(':scope > section').evaluateAll((s) => s.map((e) => e.dataset.secao));
    expect(ids).toEqual(['capa', `tela-${marcos}`, 'resumo-economico', 'resumo-geral', 'resumo-fisico']);
    await expect(doc.locator('.imp-capa-sumario li')).toHaveText(['Marcos do cliente', 'Resumo Econômico', 'Resumo Geral', 'Resumo Físico']);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  } finally {
    await salvarOrdemAbas(page, []);
  }
});

test('Exportar PDF não aparece para o Viewer', async ({ page }) => {
  await entrar(page, VIEWER);
  await page.goto('/#/cliente/inicio');
  await expect(page.getByText('Avanço físico realizado')).toBeVisible();
  await expect(page.locator('[data-teste="exportar-pdf"]')).toHaveCount(0);
});
