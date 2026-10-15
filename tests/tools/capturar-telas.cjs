/**
 * Gera as capturas de tela usadas nos relatórios (docs/MANUAL_DE_USO.html e docs/MAPA_DE_DADOS.html).
 *
 * Sobe o servidor em modo exemplo (dados fictícios, pasta de dados temporária), cadastra conteúdo de
 * demonstração (cadastro de obra, TxC, fotos, tela do cliente) e fotografa cada tela em 1600×900.
 * Para cada captura grava também a posição dos elementos anotados (docs/img/posicoes.json), usada para
 * desenhar os marcadores numerados por cima das imagens.
 *
 *   node tests/tools/capturar-telas.cjs
 *
 * Em CommonJS porque o carregador ESM do Playwright trava com acentos no caminho da pasta (Windows).
 */
const { spawn } = require('node:child_process');
const { mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require('@playwright/test');

const RAIZ = join(__dirname, '..', '..');
const PORTA = 5297;
const URL_BASE = `http://127.0.0.1:${PORTA}`;
const PASTA_IMG = join(RAIZ, 'docs', 'img');
const DADOS = join(RAIZ, 'data', 'capturas');
const LARGURA = 1600;
const ALTURA = 900;

/**
 * Telas capturadas. `antes` prepara a tela; `marcas` = [número, seletor, índice?] dos elementos anotados.
 */
const TELAS = [
  { nome: 'login', hash: '', sair: true, marcas: [[1, 'form .field:nth-of-type(1)'], [2, 'form button[type="submit"]']] },
  { nome: 'capa-obra', hash: '#/obra/inicio', marcas: [[1, '.capa-topo .filtro-excel'], [2, '.capa-kpi', 0], [3, '.capa-kpi', 1], [4, '.capa-kpi', 2], [5, '.capa-kpi', 3], [6, '.capa-atalhos']] },
  { nome: 'capa-cliente', hash: '#/cliente/inicio', marcas: [[1, '.capa-seletor-obra'], [2, '.capa-kpi', 0], [3, '.capa-kpi', 1], [4, '.capa-kpi', 2], [5, '.app-header .visao']] },
  {
    nome: 'filtro-obras', hash: '#/obra/resumo-geral',
    antes: async (p) => { await p.locator('[data-teste="filtro-obras"]').click(); await p.getByRole('searchbox', { name: 'Pesquisar' }).fill('a'); },
    marcas: [[1, '.filtro-busca'], [2, '.filtro-lista .filtro-item', 0], [3, '.filtro-grupo', 0], [4, '.filtro-rodape']],
  },
  {
    nome: 'resumo-geral', hash: '#/obra/resumo-geral',
    marcas: [[1, '.filtros'], [2, 'table.cef-fisico'], [3, '.rg-economica'], [4, '.rg-grafico', 0], [5, '.rg-grafico', 1], [6, '.rg-grafico', 2], [7, '.rg-custos'], [8, '.rg-rodape .rg-cartao', 1], [9, '.rg-rodape .rg-cartao', 2], [10, '.rg-rodape .rg-cartao', 3], [11, '.rg-titulo .btn']],
  },
  {
    nome: 'resumo-fisico', hash: '#/obra/resumo-fisico',
    antes: async (p) => { await p.getByRole('button', { name: 'Expandir ou recolher Estrutura' }).click(); },
    marcas: [[1, '.comentarios'], [2, 'thead tr.grupo th', 1], [3, 'thead tr.grupo th', 2], [4, 'thead tr.grupo th', 3], [5, 'thead tr.grupo th', 4], [6, 'tr.total'], [7, '.arvore-seta.aberta'], [8, '.btn-comentario'], [9, '.titulo-pagina .row .btn', 0]],
  },
  {
    nome: 'resumo-economico', hash: '#/obra/resumo-economico',
    antes: async (p) => { await p.getByRole('button', { name: 'Detalhes de ESTRUTURA' }).click(); },
    marcas: [[1, '.kpis-9'], [2, 'thead tr.grupo'], [3, 'tr.total'], [4, '.detalhe-blocos'], [5, '.detalhe-comentarios'], [6, '.rodape-fixo']],
  },
  { nome: 'tempo-caminho', hash: '#/obra/tempo-caminho', marcas: [[1, '.galeria-meses'], [2, '.galeria-grupos'], [3, '.galeria-palco'], [4, '.galeria-ampliar'], [5, '.galeria-lateral'], [6, '.miniaturas'], [7, '.titulo-pagina .btn.primary']] },
  { nome: 'fotos', hash: '#/obra/fotos', marcas: [[1, '.galeria-meses'], [2, '.galeria-grupos'], [3, '.galeria-palco'], [4, '.galeria-lateral']] },
  {
    nome: 'ficha-obra', hash: '#/obra/resumo-geral',
    antes: async (p) => { await p.getByRole('button', { name: '+ Infos da obra' }).click(); },
    marcas: [[1, '.ficha-identidade'], [2, '.ficha-destaques'], [3, '.ficha-secao', 0], [4, '.ficha-secao', 1], [5, '.ficha-secao', 2], [6, '.ficha-secao', 3]],
  },
  { nome: 'tela-cliente', hash: '#/cliente/inicio', antes: async (p) => { await p.locator('.capa-atalho', { hasText: 'Marcos e implantação' }).click(); }, marcas: [[1, '.app-header nav a[aria-current="page"]'], [2, '.blocos .card', 0], [3, '.blocos .card', 1], [4, '.blocos .card', 2]] },
  { nome: 'admin-cadastro', hash: '#/admin/cadastro-obras', marcas: [[1, '.admin aside nav'], [2, '.titulo-pagina .btn.secondary'], [3, '.titulo-pagina .btn.primary'], [4, '.lista-admin tbody tr', 0]] },
  {
    nome: 'admin-midia-form', hash: '#/admin/midias',
    antes: async (p) => { await p.getByRole('button', { name: 'Cadastrar imagens' }).click(); },
    marcas: [[1, '.modal .form-grade'], [2, '.modal textarea'], [3, '.modal .zona-envio'], [4, '.modal .check']],
  },
  {
    nome: 'admin-tela-form', hash: '#/admin/telas',
    antes: async (p) => { await p.getByRole('button', { name: 'Editar' }).first().click(); },
    marcas: [[1, '.modal .form-grade'], [2, '.modal .bloco-editor', 0], [3, '.modal .row .btn.secondary.sm', 0]],
  },
  { nome: 'admin-usuarios', hash: '#/admin/usuarios', marcas: [[1, '.titulo-pagina .btn.primary'], [2, '.lista-admin']] },
  { nome: 'admin-fontes', hash: '#/admin/fontes', marcas: [[1, '.rg-grade .card', 0], [2, '.rg-grade .card', 1]] },
];

async function semear(page) {
  await page.evaluate(async () => {
    const H = { 'x-requested-with': 'fetch', 'content-type': 'application/json' };
    const post = (url, corpo, metodo = 'POST') => fetch(url, { method: metodo, headers: H, body: JSON.stringify(corpo) }).then((r) => r.json());
    const imagem = async (texto, cor, largura = 1400, altura = 800) => {
      const c = document.createElement('canvas');
      c.width = largura; c.height = altura;
      const g = c.getContext('2d');
      g.fillStyle = cor; g.fillRect(0, 0, largura, altura);
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      for (let x = 0; x < largura; x += 70) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, altura); g.stroke(); }
      for (let y = 0; y < altura; y += 70) { g.beginPath(); g.moveTo(0, y); g.lineTo(largura, y); g.stroke(); }
      g.fillStyle = '#ffffff'; g.font = '600 64px Sora, Inter, sans-serif'; g.fillText(texto, 80, altura / 2);
      g.font = '28px Inter, sans-serif'; g.fillText('Imagem ilustrativa — dados fictícios', 80, altura / 2 + 56);
      return new Promise((r) => c.toBlob(r, 'image/png'));
    };
    const enviar = async (blob, nome, tipo = 'image/png') => (await fetch('/api/arquivos', { method: 'POST', headers: { 'x-requested-with': 'fetch', 'content-type': tipo, 'x-nome-arquivo': encodeURIComponent(nome) }, body: blob })).json();

    await post('/api/obras/cadastro', {
      obra: 'Edifício Beta', cliente: 'Construtora Beta', uau: '102', situacao: 'ativa', endereco: 'Rua Exemplo, 100', cidade: 'São Paulo/SP', bairro: 'Centro',
      diretoria: 'Diretoria Exemplo', coordenador: 'Coordenação A / Coordenação B', engenharia: 'Engenharia Exemplo', planejamento: 'Planejamento A / Planejamento B',
      tipologia: 'T + 19', padrao: 'Econômico', sistemaEstrutural: 'Alvenaria Estrutural', fundacao: 'Estaca Hélice', numeroTorres: '2', temBanda: '0,03',
      numeroUH: '172', unidadesHabitaveis: '172', areaEquivalente: '7848,25', areaPrivativaTotal: '5789,13', areaConstruida: '9100', areaPrivativaMedia: '33,66', coeficienteAEq: '1,36',
      inicioObra: '2025-01-06', fimObraMeta: '2026-12-20', fimObraCliente: '2027-03-30', fimObraIncorporador: '2027-01-30', prazoInicial: '24', prazoMeta: '23',
      orcamentoBase: '30000000', mesOrcamento: '2024-11-01', inccBase: '1180,5', dataBaseIncc: '2024-11-01',
    }, 'PUT');

    const cores = ['#3d3937', '#57524f', '#2b2827'];
    for (const [i, mes] of ['2026-02', '2026-03'].entries()) {
      for (const [j, torre] of ['Torre A', 'Torre B'].entries()) {
        const a = await enviar(await imagem(`TxC ${torre} — ${mes}`, cores[(i + j) % 3]), `txc-${torre}-${mes}.png`);
        await post('/api/midias', { tipo: 'txc', obra: 'Edifício Beta', mes, grupo: torre, comentario: j === 0 ? 'Alvenaria do 12º pavimento concluída; revestimento interno avançando no ritmo previsto.' : 'Estrutura do 15º pavimento com 3 dias de atraso por chuva.', arquivoId: a.id, ordem: j });
      }
    }
    for (const [i, local] of ['Fachada', 'Térreo', 'Cobertura', 'Fachada'].entries()) {
      const a = await enviar(await imagem(`Foto — ${local}`, cores[i % 3]), `foto-${i}.png`);
      await post('/api/midias', { tipo: 'foto', obra: 'Edifício Beta', mes: '2026-03', grupo: local, comentario: `Registro do mês: ${local.toLowerCase()} em execução.`, arquivoId: a.id, ordem: i });
    }

    // Tela do cliente com planilha, imagem e texto
    await new Promise((r) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = r; document.head.append(s); });
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([['Marco', 'Data prevista', 'Situação'], ['Fim da estrutura', '30/06/2026', 'No prazo'], ['Fim da alvenaria', '30/08/2026', 'No prazo'], ['Entrega das chaves', '15/12/2026', 'Em análise']]), 'Marcos');
    const planilha = await enviar(new Blob([window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]), 'marcos.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const implantacao = await enviar(await imagem('Implantação', '#fe5000', 1200, 800), 'implantacao.png');
    await post('/api/telas', {
      titulo: 'Marcos e implantação', subtitulo: 'Informações enviadas pelo Planejamento', obras: [], ordem: 1,
      blocos: [
        { tipo: 'planilha', titulo: 'Marcos da obra', arquivoId: planilha.id, arquivoNome: 'marcos.xlsx', largura: 'metade' },
        { tipo: 'imagem', titulo: 'Implantação', arquivoId: implantacao.id, arquivoNome: 'implantacao.png', largura: 'metade' },
        { tipo: 'texto', titulo: 'Observações', texto: 'Cronograma revisado em março. Próxima vistoria do cliente agendada para abril.' },
      ],
    });
    await post('/api/usuarios', { nome: 'Planejamento Exemplo', email: 'planejamento@exemplo.test', papel: 'planejamento', senha: 'exemplo-plan-123' });
    await post('/api/usuarios', { nome: 'Cliente Exemplo', email: 'viewer@exemplo.test', papel: 'viewer', senha: 'exemplo-view-123' });
  });
}

async function posicoes(page, marcas) {
  return page.evaluate((lista) => lista.map(([n, seletor, i = 0]) => {
    const el = document.querySelectorAll(seletor)[i];
    if (!el) return { n, erro: `não encontrado: ${seletor}[${i}]` };
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.left); const y = Math.max(0, r.top);
    return { n, x: x / innerWidth, y: y / innerHeight, w: Math.min(r.right, innerWidth) / innerWidth - x / innerWidth, h: Math.min(r.bottom, innerHeight) / innerHeight - y / innerHeight };
  }), marcas);
}

(async () => {
  rmSync(DADOS, { recursive: true, force: true });
  mkdirSync(PASTA_IMG, { recursive: true });
  const servidor = spawn(process.execPath, ['server/index.mjs'], {
    cwd: RAIZ, stdio: 'ignore',
    env: { ...process.env, DATA_SOURCE: 'exemplo', DATA_DIR: './data/capturas', PORT: String(PORTA), INCC_ONLINE: 'false', SESSION_SECRET: 'capturas' },
  });
  try {
    for (let t = 0; t < 50; t++) { try { if ((await fetch(`${URL_BASE}/api/saude`)).ok) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 200)); }
    const navegador = await chromium.launch({ channel: 'msedge' });
    const page = await navegador.newPage({ viewport: { width: LARGURA, height: ALTURA }, locale: 'pt-BR' });
    await page.goto(URL_BASE);
    await page.evaluate(() => fetch('/api/auth/configurar', { method: 'POST', headers: { 'x-requested-with': 'fetch', 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Planejamento Unità', email: 'dev@exemplo.test', senha: 'exemplo-dev-123' }) }));
    await semear(page);

    const resultado = {};
    for (const tela of TELAS) {
      if (tela.sair) {
        await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', headers: { 'x-requested-with': 'fetch' } }));
        await page.goto(URL_BASE);
      } else {
        await page.goto(`${URL_BASE}/${tela.hash}`);
        await page.reload();
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);
      if (tela.antes) { await tela.antes(page); await page.waitForTimeout(700); }
      await page.screenshot({ path: join(PASTA_IMG, `${tela.nome}.jpg`), type: 'jpeg', quality: 86 });
      resultado[tela.nome] = await posicoes(page, tela.marcas);
      for (const m of resultado[tela.nome]) if (m.erro) console.warn(`[${tela.nome}] ${m.erro}`);
      console.log(`capturada ${tela.nome}`);
      if (tela.sair) {
        await page.getByLabel('E-mail').fill('dev@exemplo.test');
        await page.getByLabel('Senha').fill('exemplo-dev-123');
        await page.getByRole('button', { name: 'Entrar' }).click();
        await page.waitForTimeout(800);
      }
    }
    writeFileSync(join(PASTA_IMG, 'posicoes.json'), JSON.stringify(resultado, null, 1));
    await navegador.close();
  } finally {
    servidor.kill();
    rmSync(DADOS, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
