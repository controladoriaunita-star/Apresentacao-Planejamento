/**
 * Fluxo principal: primeiro acesso, todas as abas das duas apresentações, cadastro e permissões.
 * Os testes rodam em ordem e compartilham a pasta data/e2e.
 */
const { DEV, entrar, expect, test, VIEWER } = require('./fixture.cjs');

const ABAS = ['Início', 'Resumo Geral', 'Resumo Físico', 'Resumo Econômico', 'Tempo x Caminho', 'Acompanhamento Fotográfico'];

test('primeiro acesso cria o Dev e abre o Início', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Primeiro acesso')).toBeVisible();
  await page.getByLabel('Nome').fill(DEV.nome);
  await page.getByLabel('E-mail').fill(DEV.email);
  await page.getByLabel('Senha').fill(DEV.senha);
  await page.getByRole('button', { name: 'Criar acesso Dev' }).click();
  await expect(page.getByRole('heading', { name: 'Apresentação de obras' })).toBeVisible();
  await expect(page.getByText('Obras ativas', { exact: true })).toBeVisible();
  // a capa não tem barra de filtros e, na visão Obra, mostra o Painel de obras no lugar dos atalhos
  await expect(page.locator('.filtros')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Painel de obras' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Atalhos' })).toHaveCount(0);
});

test('Painel de obras: grupos expandem, colunas fixadas ficam na tela inicial e a obra abre o Resumo Geral', async ({ page }) => {
  await entrar(page, DEV);
  await page.evaluate(() => fetch('/api/obras/cadastro', {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' },
    body: JSON.stringify({ obra: 'Torre Gama', cliente: 'Cliente Gama', numeroUH: 120 }),
  }));
  await page.goto('/#/obra/inicio');
  await page.reload();
  const painel = page.locator('.painel-obras');
  const grupos = page.getByRole('group', { name: 'Grupos de colunas' });
  const coluna = (titulo) => painel.locator('thead th', { hasText: titulo });
  await page.getByRole('button', { name: 'Todas do cadastro' }).click();
  // abre com os grupos recolhidos: só as colunas fixadas; Projeções/Tendência e Taxa Adm ficam fora do painel
  await expect(coluna('Avanço acumulado')).toBeVisible();
  await expect(coluna('Orçamento raso')).toHaveCount(0);
  await expect(grupos.getByRole('button', { name: /Taxa Adm|Projeções/ })).toHaveCount(0);
  await expect(coluna('Término projetado planejamento')).toHaveCount(0);
  // expandir o grupo mostra as demais colunas; o alfinete fixa a coluna, que fica ao recolher e após recarregar
  await grupos.getByRole('button', { name: 'Expandir Informações Gerais' }).click();
  await expect(coluna('Cidade')).toBeVisible();
  await painel.getByRole('button', { name: 'Fixar Orçamento raso (R$) na tela inicial' }).click();
  await grupos.getByRole('button', { name: 'Recolher Informações Gerais' }).click();
  await expect(coluna('Cidade')).toHaveCount(0);
  await page.reload();
  await expect(coluna('Orçamento raso')).toBeVisible();
  await painel.getByRole('button', { name: 'Desafixar Orçamento raso (R$) na tela inicial' }).click();
  await expect(coluna('Orçamento raso')).toHaveCount(0);
  await page.getByRole('button', { name: 'Todas do cadastro' }).click();
  await painel.getByRole('link', { name: 'Torre Gama' }).click();
  await expect(page).toHaveURL(/#\/obra\/resumo-geral$/);
  await expect(page.getByRole('heading', { name: /^Torre Gama/ })).toBeVisible();
});

test('todas as abas da apresentação Obra abrem sem erro', async ({ page }) => {
  await entrar(page, DEV);
  for (const aba of ABAS) {
    await page.getByRole('navigation', { name: 'Abas da apresentação' }).getByRole('link', { name: aba, exact: true }).click();
    await expect(page.locator('#conteudo .skel')).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Resumo Geral', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Curva acumulada atual × original' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(3);
  await expect(page.getByRole('table', { name: 'Quadro CEF e Físico' })).toContainText('Avanço acm');
});

test('Resumo Físico: itens pai recolhem e expandem', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-fisico');
  await expect(page.getByRole('button', { name: 'Expandir ou recolher Estrutura' })).toBeVisible();
  const filho = page.getByRole('cell', { name: /Estrutura\/Viga\/Lajes/ });
  await expect(filho).toBeHidden(); // começa recolhido, como a matriz do Power BI
  await page.getByRole('button', { name: 'Expandir ou recolher Estrutura' }).click();
  await expect(filho).toBeVisible();
  await page.getByRole('button', { name: 'Recolher tudo' }).click();
  await expect(filho).toBeHidden();
  await page.getByRole('button', { name: 'Expandir tudo' }).click();
  await expect(filho).toBeVisible();
});

test('Resumo Físico: ocultar e reexibir a projeção econômica (pesos sempre visíveis)', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-fisico');
  const projecao = page.locator('th', { hasText: 'Projeção econômica' });
  const pesos = page.locator('th', { hasText: 'Pesos' });
  await expect(projecao).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar projeção econômica' }).click();
  await expect(projecao).toBeHidden();
  await expect(pesos).toBeVisible();
  await page.reload(); // a escolha é lembrada
  await expect(page.locator('th', { hasText: 'Projeção econômica' })).toBeHidden();
  await page.getByRole('button', { name: 'Exibir projeção econômica' }).click();
  await expect(page.locator('th', { hasText: 'Projeção econômica' })).toBeVisible();
});

test('Abas do menu: com "Editar layout" o Dev arrasta para reordenar; cancelar desfaz e salvar vale após recarregar', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-geral');
  await page.waitForLoadState('networkidle'); // dados e telas extras carregados: o menu não é mais redesenhado
  const menu = page.getByRole('navigation', { name: 'Abas da apresentação' });
  const ordem = () => menu.locator('a').allInnerTexts();
  const fisico = menu.getByRole('link', { name: 'Resumo Físico' });
  const economico = menu.getByRole('link', { name: 'Resumo Econômico' });
  const original = await ordem();
  await expect(fisico).not.toHaveAttribute('draggable', 'true'); // fora da edição não arrasta

  await page.locator('[data-teste="editar-layout"]').click();
  await economico.dragTo(fisico, { targetPosition: { x: 4, y: 8 } }); // solta na metade esquerda: fica antes
  const nova = await ordem();
  expect(nova.indexOf('Resumo Econômico')).toBeLessThan(nova.indexOf('Resumo Físico'));
  await economico.click(); // enquanto edita, clicar na aba não navega
  await expect(page).toHaveURL(/resumo-geral/);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  expect(await ordem()).toEqual(original);

  await page.locator('[data-teste="editar-layout"]').click();
  await economico.dragTo(fisico, { targetPosition: { x: 4, y: 8 } });
  await page.getByRole('button', { name: 'Salvar para todas as apresentações' }).click();
  await expect(page.locator('.rg.editando')).toHaveCount(0);
  await page.reload();
  await expect(menu.locator('a')).toHaveText(nova); // espera os dados (com a ordem salva) chegarem
  await page.goto('/#/cliente/resumo-geral'); // vale também na apresentação Cliente
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-teste="editar-layout"]')).toBeVisible();
  const cliente = await ordem();
  expect(cliente.indexOf('Resumo Econômico')).toBeLessThan(cliente.indexOf('Resumo Físico'));

  // volta à ordem padrão para os próximos testes
  await page.locator('[data-teste="editar-layout"]').click();
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await page.getByRole('button', { name: 'Salvar para todas as apresentações' }).click();
  await expect(page.locator('.rg.editando')).toHaveCount(0);
  const padrao = await ordem();
  expect(padrao.indexOf('Resumo Físico')).toBeLessThan(padrao.indexOf('Resumo Econômico'));
});

test('Resumo Geral (v28): o espaço do NH-NU oculto fica livre para os vizinhos em "Editar layout"', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-geral');
  await page.waitForLoadState('networkidle');
  const incc = page.locator('[data-quadro="incc"]');
  await expect(incc).toHaveCSS('grid-column-end', 'span 4');
  await page.locator('[data-teste="editar-layout"]').click();
  await incc.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight'); // cresce sobre o espaço do NH-NU
  await expect(incc).toHaveCSS('grid-column-end', 'span 7');
  await expect(incc).not.toHaveClass(/colide/);
  await page.keyboard.press('Shift+ArrowRight'); // mais uma coluna encostaria no Andamento: não aceita
  await expect(incc).toHaveCSS('grid-column-end', 'span 7');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(incc).toHaveCSS('grid-column-end', 'span 4');
});

test('Resumo Econômico (v28): colunas "Sem correção" só na Obra; no Cliente ficam ocultas', async ({ page }) => {
  await entrar(page, DEV);
  const tabela = page.locator('.resumo-tabela table');
  await page.goto('/#/obra/resumo-economico');
  await expect(tabela.locator('th', { hasText: 'Sem correção' })).toBeVisible();
  await expect(tabela.locator('th', { hasText: 'IEC s/ correção' })).toBeVisible();
  await page.goto('/#/cliente/resumo-economico');
  await expect(tabela.locator('th', { hasText: 'Contratação' })).toBeVisible();
  await expect(tabela.locator('th', { hasText: /correção/ })).toHaveCount(0);
  await expect(tabela.locator('tr.total td')).toHaveCount(8); // Item + 7 colunas
});

test('Resumo Econômico: caixas do rodapé ficam congeladas no pé da tela', async ({ page }) => {
  await entrar(page, DEV);
  // v28: sem os indicadores do topo a página cabe em 600 px; 500 px mantém o conteúdo maior que a tela.
  await page.setViewportSize({ width: 1366, height: 500 });
  await page.goto('/#/obra/resumo-economico');
  await page.getByRole('button', { name: 'Expandir tudo' }).click(); // conteúdo maior que a tela
  const rodape = page.locator('[data-teste="rodape-economico"]');
  for (const y of [0, 10000]) {
    await page.evaluate((destino) => window.scrollTo(0, destino), y);
    const caixa = await rodape.boundingBox();
    expect(Math.round(caixa.y + caixa.height), `rodapé no pé da tela (rolagem ${y})`).toBe(500);
  }
});

test('marcador de comentário é o mesmo no Físico e no Econômico', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-fisico');
  await page.getByRole('button', { name: 'Expandir tudo' }).click();
  await expect(page.locator('.btn-comentario')).toHaveCount(1);
  await page.goto('/#/obra/resumo-economico');
  await expect(page.locator('.btn-comentario')).toHaveCount(1);
  await page.locator('.btn-comentario').click(); // abre o detalhe do item com o comentário
  await expect(page.getByText('Economia no contrato de estrutura')).toBeVisible();
});

test('Resumo Econômico: item expande com detalhes e comentários', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-economico');
  const comentario = page.getByText('Economia no contrato de estrutura');
  await expect(comentario).toBeHidden();
  await page.getByRole('button', { name: 'Detalhes de ESTRUTURA' }).click();
  await expect(comentario).toBeVisible();
  await expect(page.locator('tr.detalhe:not(.oculto)').getByText('Saldos contratos (R$)', { exact: true })).toBeVisible();
});

test('filtro de obras estilo Excel: pesquisa e aplica só os resultados', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-geral');
  await page.locator('[data-teste="filtro-obras"]').click();
  await page.getByRole('searchbox', { name: 'Pesquisar' }).fill('gama');
  await expect(page.getByText('Residencial Alpha')).toHaveCount(0);
  await page.getByLabel('(Selecionar todos os resultados)').check();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Torre Gama/ })).toBeVisible();
});

test('ficha da obra abre em tela cheia com a marca e fecha com Esc', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-geral');
  await page.getByRole('button', { name: '+ Infos da obra' }).click();
  const ficha = page.getByRole('dialog', { name: /Informações da obra/ });
  await expect(ficha).toBeVisible();
  await expect(ficha.getByRole('img', { name: 'Unità Engenharia' })).toBeVisible();
  const caixa = await ficha.boundingBox();
  const janela = page.viewportSize();
  expect(caixa.width).toBe(janela.width);
  await expect(ficha.getByText('Obra sem cadastro')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ficha).toHaveCount(0);
});

test('Resumo Geral cabe na tela sem barra de rolagem', async ({ page }) => {
  await entrar(page, DEV);
  for (const tamanho of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(tamanho);
    await page.goto('/#/obra/resumo-geral');
    await page.reload();
    await expect(page.locator('.rg.rg-tela')).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))); // v29: o app reajusta quando as fontes chegam
    const sobra = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(sobra, `rolagem em ${tamanho.width}×${tamanho.height}`).toBeLessThanOrEqual(0);
    const economica = await page.evaluate(() => { const e = document.querySelector('.rg-economica'); return e.scrollHeight - e.clientHeight; });
    expect(economica, `rolagem na análise econômica em ${tamanho.width}×${tamanho.height}`).toBeLessThanOrEqual(1);
  }
});

test('Resumo Geral: Dev redimensiona um quadro, salva para todos e restaura o padrão', async ({ page }) => {
  await entrar(page, DEV);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/obra/resumo-geral');
  await page.reload();
  await expect(page.locator('.rg.rg-tela')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mês de referência' })).toBeVisible();
  await expect(page.locator('.filtros').getByText('De', { exact: true })).toHaveCount(0); // sem intervalo por seleção
  await expect(page.locator('[data-quadro="nhnu"]')).toHaveCount(0); // v28: NH-NU oculto por enquanto
  const andamento = page.locator('[data-quadro="andamento"]');
  await expect(andamento).toHaveCSS('grid-row-start', '19');

  await page.locator('[data-teste="editar-layout"]').click();
  await expect(page.locator('.rg.editando')).toBeVisible();
  await andamento.focus();
  await page.keyboard.press('Shift+ArrowUp'); // altura 6 → 5
  await page.keyboard.press('ArrowDown'); // desce uma linha: ocupa o espaço até o pé
  await page.getByRole('button', { name: 'Salvar para todas as apresentações' }).click();
  await expect(page.locator('.rg.editando')).toHaveCount(0);
  await page.reload();
  await expect(andamento).toHaveCSS('grid-row-start', '20');

  await page.locator('[data-teste="editar-layout"]').click();
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await page.getByRole('button', { name: 'Salvar para todas as apresentações' }).click();
  await expect(page.locator('.rg.editando')).toHaveCount(0);
  await expect(andamento).toHaveCSS('grid-row-start', '19');
});

// v27: o conteúdo do quadro acompanha o tamanho dele (fonte e arranjo), sem nada cortado.
test('Resumo Geral: quadro redimensionado ajusta fonte e colunas sem cortar valores', async ({ page }) => {
  await entrar(page, DEV);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/obra/resumo-geral');
  await page.reload();
  await expect(page.locator('.rg.rg-tela')).toBeVisible();
  const medir = () => page.evaluate(() => Object.fromEntries(['cef', 'economica', 'custos', 'incc'].map((id) => {
    const c = document.querySelector(`[data-quadro="${id}"]`);
    const conteudo = c.querySelector('.rg-conteudo');
    const cortado = c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1;
    return [id, { fonte: parseFloat(conteudo.style.fontSize), colunas: conteudo.className.match(/colunas-\d/)?.[0] ?? null, cortado }];
  })));
  const antes = await medir();
  for (const [id, q] of Object.entries(antes)) {
    expect(q.cortado, `${id} cortado`).toBe(false);
    expect(q.fonte, `${id} com fonte ajustada`).toBeGreaterThanOrEqual(10);
  }

  // Dev estreita a Análise econômica (6 → 4 colunas da grade): fonte menor, arranjo trocado, nada cortado.
  await page.locator('[data-teste="editar-layout"]').click();
  await page.locator('[data-quadro="economica"]').focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect.poll(async () => (await medir()).economica.fonte).toBeLessThan(antes.economica.fonte);
  const estreita = (await medir()).economica;
  expect(estreita.cortado).toBe(false);
  expect(estreita.colunas).not.toBe('colunas-3');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect.poll(async () => (await medir()).economica.fonte).toBe(antes.economica.fonte);
});

test('mudar o mês de referência recalcula o Resumo Geral', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-geral');
  await page.locator('[data-teste="mes-referencia"]').click();
  await page.getByRole('option', { name: 'JUN/25' }).click();
  await expect(page.locator('[data-teste="competencia"]')).toContainText('Junho de 2025');
});

test('Resumo Físico: simular o resumo da obra sem atividades', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-fisico');
  await expect(page.locator('[data-teste="competencia"]')).toBeVisible();
  const linhaSimulada = page.locator('tr.simulada');
  await expect(linhaSimulada).toBeHidden(); // só aparece com a simulação ligada
  await page.locator('[data-teste="simular"]').click();
  await expect(page.getByText('Marque na tabela as atividades')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Retirar Estrutura da simulação' }).check();
  await expect(linhaSimulada).toContainText('sem 02 Estrutura');
  await expect(page.locator('.simulacao-painel')).toContainText('Desvio da meta');
  await page.getByRole('button', { name: 'Limpar' }).click();
  await expect(page.getByRole('checkbox', { name: 'Retirar Estrutura da simulação' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Encerrar simulação' }).click();
  await expect(page.locator('.simulacao-painel')).toHaveCount(0);
  await expect(linhaSimulada).toBeHidden();
});

test('capa do Cliente não mostra indicadores da empresa', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/cliente/inicio');
  await expect(page.getByText('Avanço físico realizado')).toBeVisible();
  for (const texto of ['Obras ativas', 'Assertividade média', 'Maior assertividade no mês', 'Unidades construídas no mês']) {
    await expect(page.getByText(texto, { exact: true })).toHaveCount(0);
  }
});

test('Resumo Físico não mostra os comentários gerais no cabeçalho', async ({ page }) => {
  await entrar(page, DEV);
  for (const visao of ['obra', 'cliente']) {
    await page.goto(`/#/${visao}/resumo-fisico`);
    await expect(page.locator('[data-teste="simular"]')).toBeVisible();
    for (const texto of ['Comentário do mês', 'Principais metas', 'Comentário para o cliente', 'Comentário interno da obra']) {
      await expect(page.getByText(texto)).toHaveCount(0);
    }
  }
});

test('galeria de fotos: meses, locais, teclado e ampliar', async ({ page }) => {
  await entrar(page, DEV);
  await page.evaluate(async () => {
    const png = await new Promise((r) => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.toBlob(r, 'image/png'); });
    for (const [i, local] of ['Fachada', 'Fachada', 'Térreo'].entries()) {
      const a = await (await fetch('/api/arquivos', { method: 'POST', headers: { 'x-requested-with': 'fetch', 'content-type': 'image/png' }, body: png })).json();
      await fetch('/api/midias', { method: 'POST', headers: { 'x-requested-with': 'fetch', 'content-type': 'application/json' },
        body: JSON.stringify({ tipo: 'foto', obra: 'Residencial Alpha', mes: '2026-03', grupo: local, comentario: `Comentário ${i + 1}`, arquivoId: a.id }) });
    }
  });
  await page.goto('/#/obra/fotos');
  await page.locator('[data-teste="filtro-obras"]').click();
  await page.getByRole('searchbox', { name: 'Pesquisar' }).fill('alpha');
  await page.getByLabel('(Selecionar todos os resultados)').check();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('tab', { name: /MAR\/26/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Térreo/ })).toBeVisible();
  await expect(page.locator('.galeria-contagem')).toHaveText('1 / 2');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.galeria-contagem')).toHaveText('2 / 2');
  await expect(page.locator('.galeria-lateral')).toContainText('Comentário 2');
  // v29: a imagem aparece inteira no palco (ajustada ao espaço)
  const caixas = await page.evaluate(() => {
    const palco = document.querySelector('.galeria-palco').getBoundingClientRect();
    const img = document.querySelector('.galeria-palco > img').getBoundingClientRect();
    return { palco: palco.toJSON(), img: img.toJSON() };
  });
  expect(caixas.img.width).toBeLessThanOrEqual(caixas.palco.width + 1);
  expect(caixas.img.height).toBeLessThanOrEqual(caixas.palco.height + 1);
  await page.getByRole('button', { name: 'Ampliar' }).click();
  await expect(page.locator('.visor')).toBeVisible();
  // v29: em tela cheia navega sem fechar e o zoom liga e desliga
  await expect(page.locator('.visor .galeria-contagem')).toHaveText('2 / 2');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.visor .galeria-contagem')).toHaveText('1 / 2');
  await expect(page.locator('.visor-legenda')).toContainText('Comentário 1');
  await page.locator('.visor').getByRole('button', { name: 'Próxima imagem' }).click();
  await expect(page.locator('.visor .galeria-contagem')).toHaveText('2 / 2');
  await page.locator('.visor').getByRole('button', { name: 'Zoom' }).click();
  await expect(page.locator('.visor')).toHaveClass(/com-zoom/);
  await page.locator('.visor').getByRole('button', { name: 'Ajustar à tela' }).click();
  await expect(page.locator('.visor')).not.toHaveClass(/com-zoom/);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(page.locator('.visor')).toHaveCount(0);
  await expect(page.locator('.galeria-palco .galeria-contagem')).toHaveText('1 / 2'); // o palco fica na última vista
});

test('Resumo Geral (v29): "Detalhe" abre o gráfico em tela cheia com a tabela dos meses', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-geral');
  await page.locator('[data-teste="detalhe-curva"]').click();
  const painel = page.locator('[data-teste="detalhe-grafico"]');
  await expect(painel).toBeVisible();
  await expect(painel.getByRole('heading', { name: 'Curva acumulada atual × original' })).toBeVisible();
  const tabela = painel.getByRole('table', { name: /valores por mês/ });
  await expect(tabela.locator('thead th')).toHaveText(['Mês', 'Previsto original', 'Realizado', 'Planejado atual']);
  expect(await tabela.locator('tbody tr').count()).toBeGreaterThan(6);
  await expect(tabela.locator('tr.referencia')).toHaveCount(1);
  await expect(tabela.locator('tr.referencia')).toBeInViewport();
  await expect(painel.locator('canvas')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(painel).toHaveCount(0);
  await page.locator('[data-teste="detalhe-assertividade"]').click();
  await expect(page.locator('[data-teste="detalhe-grafico"] .detalhe-grafico-tabela thead th')).toHaveText(['Mês', 'Assertividade']);
  await page.locator('[data-teste="detalhe-grafico"]').getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('[data-teste="detalhe-grafico"]')).toHaveCount(0);
});

test('Dev (v29): renomeia uma coluna do Econômico (vale na Obra e no Cliente) e volta ao original', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-economico');
  const cabecalho = page.locator('.resumo-tabela thead');
  await expect(cabecalho).toContainText('Custo lançado (R$)');
  await page.locator('[data-teste="nomes-colunas"]').click();
  const janela = page.getByRole('dialog', { name: /Nomes das colunas/ });
  await janela.getByLabel(/Novo nome para Custo lançado/).fill('Custo incorrido');
  await janela.getByLabel(/Novo nome para Execução/).fill('Realização');
  await janela.getByRole('button', { name: 'Salvar para todas as apresentações' }).click();
  await expect(janela).toHaveCount(0);
  await expect(cabecalho).toContainText('Custo incorrido (R$)');
  await expect(cabecalho).toContainText('Realização');
  await page.goto('/#/cliente/resumo-economico');
  await expect(page.locator('.resumo-tabela thead')).toContainText('Custo incorrido (R$)');

  await page.goto('/#/obra/resumo-economico');
  await page.locator('[data-teste="nomes-colunas"]').click();
  await janela.locator('.nomes-linha', { hasText: 'Custo lançado' }).getByRole('button', { name: 'Original' }).click();
  await janela.getByLabel('Novo nome para Execução (Grupo)').fill(''); // vazio = nome original
  await janela.getByRole('button', { name: 'Salvar para todas as apresentações' }).click();
  await expect(cabecalho).toContainText('Custo lançado (R$)');
  await expect(cabecalho).not.toContainText('Custo incorrido');
});

test('Dev (v29): comentário da tela fica gravado na obra e no mês', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-fisico');
  await page.locator('[data-teste="comentarios-tela"]').click();
  const painel = page.locator('[data-teste="painel-comentarios"]');
  await expect(painel).toContainText('Nenhum comentário nesta tela no mês');
  await painel.getByLabel('Novo comentário').fill('Cliente pediu revisão da estrutura');
  await painel.getByRole('button', { name: 'Salvar comentário' }).click();
  await expect(painel.locator('.comentario-tela')).toContainText('Cliente pediu revisão da estrutura');
  await page.keyboard.press('Escape');
  await expect(painel).toHaveCount(0);
  await expect(page.locator('[data-teste="comentarios-tela"] .comentarios-contador')).toHaveText('1');
  await page.reload();
  await page.locator('[data-teste="comentarios-tela"]').click();
  await expect(page.locator('[data-teste="painel-comentarios"] .comentario-tela')).toContainText('Cliente pediu revisão da estrutura');
  await page.keyboard.press('Escape');
  // outra tela do mesmo mês: sem o comentário
  await page.goto('/#/obra/resumo-economico');
  await page.locator('[data-teste="comentarios-tela"]').click();
  await expect(page.locator('[data-teste="painel-comentarios"]')).toContainText('Nenhum comentário nesta tela no mês');
});

test('Novas telas e imagens aparecem só na apresentação escolhida (Obra, Cliente ou ambas)', async ({ page }) => {
  await entrar(page, DEV);
  await page.evaluate(async () => {
    const H = { 'x-requested-with': 'fetch', 'content-type': 'application/json' };
    const post = (url, corpo) => fetch(url, { method: 'POST', headers: H, body: JSON.stringify(corpo) });
    for (const [titulo, destino] of [['Equipe interna', 'obra'], ['Marcos do cliente', 'cliente'], ['Cronograma geral', 'ambas']]) {
      await post('/api/telas', { titulo, destino, blocos: [{ tipo: 'texto', texto: `Conteúdo de ${titulo}` }] });
    }
    const png = await new Promise((r) => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.toBlob(r, 'image/png'); });
    for (const [local, destino] of [['Decorado', 'cliente'], ['Canteiro', 'obra']]) {
      const a = await (await fetch('/api/arquivos', { method: 'POST', headers: { 'x-requested-with': 'fetch', 'content-type': 'image/png' }, body: png })).json();
      await post('/api/midias', { tipo: 'foto', obra: 'Residencial Alpha', mes: '2026-03', grupo: local, arquivoId: a.id, destino });
    }
  });

  // Telas no menu de cada apresentação
  const menu = page.getByRole('navigation', { name: 'Abas da apresentação' });
  await page.goto('/#/obra/resumo-fisico');
  await expect(menu.getByRole('link', { name: 'Equipe interna' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Cronograma geral' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Marcos do cliente' })).toHaveCount(0);
  await menu.getByRole('link', { name: 'Equipe interna' }).click();
  await expect(page).toHaveURL(/#\/obra\/tela\//);
  await expect(page.getByText('Conteúdo de Equipe interna')).toBeVisible();
  await expect(page.getByText('Apresentação da obra')).toBeVisible();

  await page.goto('/#/cliente/resumo-fisico');
  await expect(menu.getByRole('link', { name: 'Marcos do cliente' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Cronograma geral' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Equipe interna' })).toHaveCount(0);

  // Fotos de cada apresentação (obra Alpha, mês 03/2026)
  await page.goto('/#/obra/fotos');
  await page.locator('[data-teste="filtro-obras"]').click();
  await page.getByRole('searchbox', { name: 'Pesquisar' }).fill('alpha');
  await page.getByLabel('(Selecionar todos os resultados)').check();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('tab', { name: /MAR\/26/ }).click();
  await expect(page.getByRole('tab', { name: /Canteiro/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Decorado/ })).toHaveCount(0);
  await page.goto('/#/cliente/fotos');
  await page.getByRole('tab', { name: /MAR\/26/ }).click();
  await expect(page.getByRole('tab', { name: /Decorado/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Canteiro/ })).toHaveCount(0);

  // Administração: nome novo e caixa "Apresentação" nos dois formulários
  await page.goto('/#/admin/telas');
  await expect(page.getByRole('heading', { name: 'Novas telas' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Equipe interna/ })).toContainText('Somente Obra');
  await page.getByRole('button', { name: 'Nova tela' }).click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: /^Apresentação/ })).toHaveValue('cliente');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.goto('/#/admin/midias');
  await page.getByRole('button', { name: 'Acompanhamento fotográfico' }).click();
  await expect(page.getByRole('row', { name: /Decorado/ })).toContainText('Somente Cliente');
  await page.getByRole('button', { name: 'Cadastrar imagens' }).click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: /^Apresentação/ })).toHaveValue('ambas');
  await expect(page.getByText('Exibir na apresentação ao cliente')).toHaveCount(0);
});

test('Dev cadastra um Viewer, que não vê a administração', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/admin/usuarios');
  await page.getByRole('button', { name: 'Novo usuário' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Nome').fill(VIEWER.nome);
  await modal.getByLabel('E-mail').fill(VIEWER.email);
  await modal.getByLabel('Papel').selectOption('viewer');
  await modal.getByLabel('Senha inicial').fill(VIEWER.senha);
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('cell', { name: VIEWER.email })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await entrar(page, VIEWER);
  await expect(page.getByRole('link', { name: 'Administração' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Atualizar dados' })).toHaveCount(0);
});
