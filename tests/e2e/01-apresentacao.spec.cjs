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
  await painel.getByRole('button', { name: 'Fixar Orçamento raso na tela inicial' }).click();
  await grupos.getByRole('button', { name: 'Recolher Informações Gerais' }).click();
  await expect(coluna('Cidade')).toHaveCount(0);
  await page.reload();
  await expect(coluna('Orçamento raso')).toBeVisible();
  await painel.getByRole('button', { name: 'Desafixar Orçamento raso na tela inicial' }).click();
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

test('Resumo Físico: ocultar e reexibir a projeção econômica e os pesos', async ({ page }) => {
  await entrar(page, DEV);
  await page.goto('/#/obra/resumo-fisico');
  const projecao = page.locator('th', { hasText: 'Projeção econômica' });
  const pesos = page.locator('th', { hasText: 'Pesos' });
  await expect(projecao).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar projeção econômica e pesos' }).click();
  await expect(projecao).toBeHidden();
  await expect(pesos).toBeHidden();
  await page.reload(); // a escolha é lembrada
  await expect(page.locator('th', { hasText: 'Projeção econômica' })).toBeHidden();
  await page.getByRole('button', { name: 'Exibir projeção econômica e pesos' }).click();
  await expect(page.locator('th', { hasText: 'Projeção econômica' })).toBeVisible();
});

test('Resumo Econômico: caixas do rodapé ficam congeladas no pé da tela', async ({ page }) => {
  await entrar(page, DEV);
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.goto('/#/obra/resumo-economico');
  await page.getByRole('button', { name: 'Expandir tudo' }).click(); // conteúdo maior que a tela
  const rodape = page.locator('[data-teste="rodape-economico"]');
  for (const y of [0, 10000]) {
    await page.evaluate((destino) => window.scrollTo(0, destino), y);
    const caixa = await rodape.boundingBox();
    expect(Math.round(caixa.y + caixa.height), `rodapé no pé da tela (rolagem ${y})`).toBe(600);
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
  await expect(page.locator('tr.detalhe:not(.oculto)').getByText('Saldos contratos', { exact: true })).toBeVisible();
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
    const sobra = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(sobra, `rolagem em ${tamanho.width}×${tamanho.height}`).toBeLessThanOrEqual(0);
    const economica = await page.evaluate(() => { const e = document.querySelector('.rg-economica'); return e.scrollHeight - e.clientHeight; });
    expect(economica, `rolagem na análise econômica em ${tamanho.width}×${tamanho.height}`).toBeLessThanOrEqual(1);
  }
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
  await page.getByRole('button', { name: 'Ampliar' }).click();
  await expect(page.locator('.visor')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.visor')).toHaveCount(0);
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
