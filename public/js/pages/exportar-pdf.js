/**
 * "Exportar PDF" da apresentação Cliente (Planejamento e Dev): monta um documento com as seções da
 * apresentação de UMA obra no mês de referência e abre a impressão do navegador ("Salvar como PDF").
 *
 * - As seções são as mesmas telas do Cliente (mesmas funções de render, base `cliente`), montadas fora da
 *   tela num bloco com a largura útil de uma A4 paisagem; o css/impressao.css esconde botões e filtros e
 *   cuida das quebras de página.
 * - Resumo Geral, Físico e Econômico: uma página cada. Físico e Econômico saem como abrem na tela (só os itens
 *   principais) e são reduzidos só o necessário para caber inteiros na página.
 * - TxC e fotos: todas as imagens do mês exibido (o de referência ou o anterior mais recente com imagens),
 *   uma por página (TxC) ou duas (fotos), com torre/local e comentário.
 * - Gráficos viram imagens PNG em alta resolução (3×) antes de imprimir: nítidos e sem redimensionar.
 * - Cabeçalho e rodapé (obra, competência, nº da página) são regras @page geradas aqui.
 */
import { api } from '../core/api.js';
import { h, montar, token } from '../core/dom.js';
import { estado } from '../core/estado.js';
import { fmtMes, fmtMesLongo, fmtPercentual, fmtVariacao } from '../core/formato.js';
import { TIPOS_MIDIA, midiasDaVisao } from '../domain/conteudo.js';
import { abrirModal, alerta, campo, toast } from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { mesExibido } from './galeria.js';
import { dadosCapaCliente } from './inicio.js';
import { ajustarQuadros, FONTE_QUADRO, proporcaoNaTela } from './resumo-geral.js';

const CAPA = { id: 'capa', nome: 'Capa' };
const ESPERA_MAXIMA = 45000; // ms para planilhas, físico por atividade e imagens carregarem

/**
 * Janela de opções: obra (as do Cliente com dados) e seções, todas marcadas, na ordem das abas.
 * @param {{ secoesDaObra: (chave: string) => Array<{id: string, nome: string, render: Function}> }} opcoes
 */
export function abrirExportarPdf({ secoesDaObra }) {
  const base = estado.base('cliente');
  const referencia = estado.filtro.referencia;
  const obras = base.obras.filter((o) => base.infos.has(o.chave));
  if (!obras.length) return toast('warning', 'Nenhuma obra com dados para exportar');
  let chave = obras.some((o) => o.chave === estado.filtro.obras[0]) ? estado.filtro.obras[0] : obras[0].chave;
  const desmarcadas = new Set();
  const secoes = () => [CAPA, ...secoesDaObra(chave)];

  const lista = h('div', { class: 'exportar-secoes', role: 'group', 'aria-label': 'Seções do PDF' });
  const desenharLista = () => montar(lista, secoes().map((s) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: !desmarcadas.has(s.id), onchange: (e) => (e.target.checked ? desmarcadas.delete(s.id) : desmarcadas.add(s.id)) }),
    s.nome)));
  desenharLista();
  const seletor = h('select', { onchange: (e) => { chave = e.target.value; desenharLista(); } },
    obras.map((o) => h('option', { value: o.chave, selected: o.chave === chave }, o.nome)));

  const m = abrirModal({
    titulo: 'Exportar PDF — apresentação ao cliente',
    conteudo: h('div', { class: 'stack' },
      campo('Obra', seletor),
      h('p', { class: 'muted small' }, `Competência: ${fmtMesLongo(referencia)} (mês de referência do filtro). A4 paisagem; na janela de impressão, escolha "Salvar como PDF".`),
      h('div', {}, h('p', { class: 'sub' }, 'Seções'), lista)),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      h('button', {
        class: 'btn primary', type: 'button', 'data-teste': 'gerar-pdf',
        onclick: () => {
          const escolhidas = secoes().filter((s) => !desmarcadas.has(s.id));
          if (!escolhidas.length) return toast('warning', 'Marque ao menos uma seção');
          m.fechar();
          gerarPdf({
            base, chave, referencia,
            comCapa: escolhidas.some((s) => s.id === CAPA.id),
            secoes: escolhidas.filter((s) => s.id !== CAPA.id),
          });
        },
      }, icone('baixar', { tamanho: 16 }), 'Gerar PDF'),
    ],
  });
}

/** Seções que saem inteiras numa página só, reduzidas o mínimo necessário para caber. */
const UMA_PAGINA = new Set(['resumo-fisico', 'resumo-economico']);
const PX_POR_MM = 96 / 25.4;
const PAGINA = { largura: 277 * PX_POR_MM, altura: 178 * PX_POR_MM }; // área útil da A4 paisagem (css/impressao.css)

/** Seções com montagem própria no PDF (as galerias da tela mostram uma imagem por vez). */
const ESPECIAIS = {
  'tempo-caminho': (alvo, ctx) => galeriaImpressa(alvo, ctx, 'txc'),
  fotos: (alvo, ctx) => galeriaImpressa(alvo, ctx, 'foto'),
};

let emAndamento = false;

async function gerarPdf({ base, chave, referencia, comCapa, secoes }) {
  if (emAndamento) return;
  emAndamento = true;
  document.querySelector('.impressao')?.remove(); // sobra de uma exportação anterior
  const obra = base.obras.find((o) => o.chave === chave);
  const filtro = { ...estado.filtro, obras: [chave], obraUnica: chave, referencia };
  const ctx = { base, filtro, visao: 'cliente', usuario: estado.usuario, abas: [], telas: [], impressao: true };
  const doc = h('div', { class: 'impressao', 'data-teste': 'impressao' });
  const aviso = h('div', { class: 'impressao-preparando', role: 'status' },
    h('div', {}, h('span', { class: 'spin' }), h('b', {}, 'Montando o PDF…'), h('small', {}, `${obra.nome} · ${fmtMesLongo(referencia)}`)));
  document.body.append(doc, aviso);
  document.body.classList.add('imprimindo');
  let alturaGeralMm = null; // v30: altura do Resumo Geral montado (mm) — define a folha própria dele

  try {
    const incluidas = [];
    for (const s of secoes) {
      const alvo = h('div');
      const secao = h('section', { class: `imp-secao imp-${s.id.startsWith('tela-') ? 'tela' : s.id}`, dataset: { secao: s.id } }, alvo);
      doc.append(secao);
      let manter = true;
      try {
        manter = (await (ESPECIAIS[s.id] ?? s.render)(alvo, ctx)) !== false;
      } catch (e) {
        montar(alvo, alerta('error', `Não foi possível montar "${s.nome}"`, e.message));
      }
      if (manter) incluidas.push(s);
      else secao.remove(); // galeria sem imagens: fica fora do PDF
    }
    if (comCapa) doc.prepend(capa(base, filtro, incluidas));
    await esperarCarregamentos(doc);
    // v28: medir só com as fontes da página carregadas — medido antes, o texto crescia ao trocar a fonte e cortava quadros.
    await Promise.race([document.fonts?.ready, pausa(5000)]);
    recolherTabelas(doc);
    const geral = doc.querySelector('[data-secao="resumo-geral"] > div');
    const montagemGeral = geral ? enquadrarResumoGeral(geral) : null;
    // v30: os gráficos viram imagem ANTES da redução do Resumo Geral — reduzidos depois, encolhiam duas vezes e
    // ocupavam só parte do quadro.
    graficosComoImagem(doc);
    if (montagemGeral) {
      geral.style.zoom = montagemGeral.zoom;
      geral.dataset.zoom = montagemGeral.zoom;
      alturaGeralMm = montagemGeral.alturaMm;
    }
    ajustarTabelasALargura(doc);
    for (const id of UMA_PAGINA) {
      const alvo = doc.querySelector(`[data-secao="${id}"] > div`);
      if (alvo) enquadrarEmUmaPagina(alvo);
    }
    await esperarImagens(doc);
  } catch (e) {
    doc.remove();
    document.body.classList.remove('imprimindo');
    toast('error', 'Não foi possível montar o PDF', e.message);
    return;
  } finally {
    aviso.remove();
    emAndamento = false;
  }
  imprimir(doc, obra, referencia, alturaGeralMm);
}

// ── Seções ─────────────────────────────────────────────────────────────
/** v32 — Quadros de indicadores da capa (avanço, planejado e desvio) ocultos por enquanto (pedido do usuário). */
const INDICADORES_NA_CAPA = false;

function capa(base, filtro, secoes) {
  const { obra, info, desvio } = dadosCapaCliente(base, filtro.obras[0], filtro.referencia);
  const indicador = (rotulo, valor, detalhe) => h('div', { class: 'imp-capa-kpi' }, h('span', {}, rotulo), h('b', {}, valor), detalhe ? h('small', {}, detalhe) : null);
  return h('section', { class: 'imp-capa', dataset: { secao: CAPA.id } },
    h('img', { class: 'imp-capa-padrao', src: 'assets/brand/pattern-un.png', alt: '' }),
    h('img', { class: 'imp-capa-logo', src: 'assets/brand/logo-unita-white.png', alt: 'Unità Engenharia' }),
    h('div', { class: 'imp-capa-titulo' },
      h('div', { class: 'eyebrow' }, obra?.cliente ? `Apresentação ao cliente · ${obra.cliente}` : 'Apresentação ao cliente'),
      h('h1', {}, obra?.nome ?? ''),
      h('p', {}, `Fechamento de ${fmtMesLongo(filtro.referencia)}`)),
    INDICADORES_NA_CAPA ? h('div', { class: 'imp-capa-kpis' },
      indicador('Avanço físico realizado', fmtPercentual(info?.realizadoAcm, 1), 'acumulado até o mês'),
      indicador('Planejado acumulado', fmtPercentual(info?.replanAcm, 1), 'cronograma atual'),
      indicador('Desvio', fmtVariacao(desvio, 1), desvio === null ? null : desvio >= 0 ? 'adiantado em relação ao planejado' : 'atrasado em relação ao planejado')) : null,
    secoes.length ? h('div', { class: 'imp-capa-sumario' }, h('span', {}, 'Conteúdo'), h('ol', {}, secoes.map((s) => h('li', {}, s.nome)))) : null);
}

/** TxC e fotos do mês exibido, agrupados por torre/local na ordem da tela. Sem imagens: a seção sai do PDF. */
async function galeriaImpressa(alvo, { base, filtro }, tipo) {
  const def = TIPOS_MIDIA[tipo];
  const obra = base.obras.find((o) => o.chave === filtro.obras[0]);
  const lista = midiasDaVisao(await api.get(`/midias?tipo=${tipo}&chaveObra=${encodeURIComponent(obra.chave)}`), 'cliente');
  const meses = [...new Set(lista.map((m) => m.mes))].sort().reverse();
  if (!meses.length) return false;
  const mes = mesExibido(meses, filtro.referencia);
  const doMes = lista.filter((m) => m.mes === mes).sort((a, b) => a.ordem - b.ordem || String(a.grupo).localeCompare(String(b.grupo)));
  const grupos = [...new Set(doMes.map((m) => m.grupo ?? 'Geral'))];
  const itens = grupos.flatMap((g) => doMes.filter((m) => (m.grupo ?? 'Geral') === g));
  const porLinha = tipo === 'txc' ? 1 : 2;
  const linhas = [];
  for (let i = 0; i < itens.length; i += porLinha) linhas.push(itens.slice(i, i + porLinha));

  montar(alvo,
    h('div', { class: 'titulo-pagina' },
      h('div', { class: 'titulo-com-competencia' },
        h('div', {}, h('div', { class: 'eyebrow' }, def.nome), h('h1', {}, obra.nome)))),
    mes !== filtro.referencia ? alerta('info', `Sem imagens em ${fmtMes(filtro.referencia)}`, `Imagens de ${fmtMesLongo(mes)}.`) : null,
    h('div', { class: `imp-galeria imp-galeria-${tipo}` }, linhas.map((linha) => h('div', { class: 'imp-figura-linha' }, linha.map((m) => {
      const grupo = m.grupo ?? 'Geral';
      return h('figure', { class: 'imp-figura' },
        h('img', { src: api.urlArquivo(m.arquivoId), alt: `${def.nome} — ${obra.nome} — ${grupo} — ${fmtMes(mes)}` }),
        h('figcaption', {},
          h('div', { class: 'imp-figura-topo' }, h('span', { class: 'sub' }, def.grupo), h('b', {}, grupo), h('span', { class: 'muted' }, fmtMesLongo(mes))),
          m.comentario ? h('p', {}, m.comentario) : null));
    })))));
  return true;
}

// ── Preparação para imprimir ──────────────────────────────────────────
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera o que as seções carregam depois de montar (físico por atividade, planilhas das telas extras). */
async function esperarCarregamentos(doc) {
  const limite = Date.now() + ESPERA_MAXIMA;
  while (doc.querySelector('.skel, [aria-busy="true"], .carregando-msg') && Date.now() < limite) await pausa(100);
}

/** Físico e Econômico como abrem na tela: só os itens principais (sem subitens e sem detalhes); sem a simulação. */
function recolherTabelas(doc) {
  for (const tr of doc.querySelectorAll('tr[data-filho-de], tr.detalhe')) tr.classList.add('oculto');
  for (const planilha of doc.querySelectorAll('.sheet.simulando')) planilha.classList.remove('simulando');
  for (const area of doc.querySelectorAll('.simulacao-area')) area.replaceChildren();
}

/** v30 — Limites da proporção do Resumo Geral no PDF: nunca mais alto que a folha; nunca uma faixa fina demais. */
const PROPORCAO_PDF = Object.freeze({ min: PAGINA.largura / PAGINA.altura, max: 3 });
/** Maior largura de montagem do Resumo Geral (px) antes da redução para a página. */
const LARGURA_MAXIMA_GERAL = 2600;

/**
 * Resumo Geral numa página com a menor redução possível. v30: a grade tem a mesma proporção da tela
 * (proporcaoNaTela) — ocupa a largura da página e a altura que tinha na tela, sem esticar na vertical; a folha
 * dessa página tem a altura exata da grade (regrasPagina, `@page resumo-geral`). Cada quadro ajusta a fonte ao
 * próprio tamanho (fonte global, como na tela); se algum não couber nem na fonte mínima, a área cresce (6% por
 * vez, mantendo a proporção) e o zoom a traz de volta à largura da página. Os gráficos se ajustam a qualquer
 * tamanho e não entram na conta. Devolve { zoom, alturaMm } — o zoom é aplicado por gerarPdf depois de
 * converter os gráficos em imagem; alturaMm é a altura final da grade na página.
 */
function enquadrarResumoGeral(alvo) {
  const rg = alvo.querySelector('.rg.rg-tela');
  if (!rg) return null;
  const proporcao = Math.min(PROPORCAO_PDF.max, Math.max(PROPORCAO_PDF.min, proporcaoNaTela()));
  const cortado = (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  let largura = Math.floor(PAGINA.largura);
  for (;;) {
    alvo.style.width = `${largura}px`;
    rg.style.height = `${Math.floor(largura / proporcao)}px`;
    const couberam = ajustarQuadros(rg, FONTE_QUADRO.impressao);
    if (couberam && ![...rg.querySelectorAll('.rg-cartao:not(.rg-grafico)')].some(cortado)) break;
    if (largura >= LARGURA_MAXIMA_GERAL) break;
    largura = Math.min(LARGURA_MAXIMA_GERAL, Math.round(largura * 1.06));
  }
  rg.dataset.proporcao = proporcao.toFixed(3);
  // A redução é calculada com a largura realmente montada (a última testada).
  const zoom = Math.min(1, PAGINA.largura / largura).toFixed(4);
  return { zoom, alturaMm: (Math.floor(largura / proporcao) * Number(zoom)) / PX_POR_MM };
}

/**
 * A seção inteira numa página, ocupando a página o máximo possível:
 * 1. a largura de montagem cresce enquanto a altura for o limite (a tabela alarga, as descrições quebram menos
 *    linhas e a redução diminui) e para quando a largura passa a limitar;
 * 2. se ainda sobrar altura, as linhas da tabela ficam mais altas (até +24 px cada) para preencher a página;
 * 3. o zoom final leva o bloco à largura/altura útil (pode ampliar até 1,2× uma tabela pequena).
 */
function enquadrarEmUmaPagina(alvo) {
  const tabela = alvo.querySelector('.sheet > table');
  if (tabela) tabela.style.zoom = '';
  alvo.style.zoom = '';
  const larguraReal = (w) => Math.max(w, (tabela?.offsetWidth ?? 0) + 4);
  const fatorDe = (largura) => Math.min(1.2, PAGINA.largura / largura, PAGINA.altura / alvo.scrollHeight);
  let melhor = null;
  for (let w = Math.floor(PAGINA.largura); w <= 3200; w += 40) {
    alvo.style.width = `${w}px`;
    const largura = larguraReal(w);
    const fator = fatorDe(largura);
    if (!melhor || fator > melhor.fator + 0.0005) melhor = { largura, fator };
    if (PAGINA.largura / largura <= PAGINA.altura / alvo.scrollHeight) break; // a largura passou a limitar
  }
  alvo.style.width = `${Math.ceil(melhor.largura)}px`;
  const linhas = [...alvo.querySelectorAll('.sheet tbody tr')].filter((tr) => tr.offsetParent !== null);
  const sobra = PAGINA.altura / fatorDe(melhor.largura) - alvo.scrollHeight;
  if (linhas.length && sobra > 4) {
    const extra = Math.min(sobra / linhas.length, 24);
    const alturas = linhas.map((tr) => tr.getBoundingClientRect().height);
    linhas.forEach((tr, i) => { tr.style.height = `${Math.floor(alturas[i] + extra)}px`; });
  }
  alvo.style.zoom = (fatorDe(melhor.largura) * 0.99).toFixed(4); // 1% de folga para arredondamentos da impressão
  alvo.dataset.zoom = alvo.style.zoom;
}

/**
 * Cada gráfico Chart.js vira uma imagem do tamanho do seu quadro, desenhada em 3× (nítida na impressão).
 * v30: o gráfico é redesenhado numa cópia já no tamanho final do quadro (sem animação e sem responsividade) —
 * redimensionar o gráfico existente não pegava o tamanho do Resumo Geral montado maior para o PDF, e ele saía
 * ocupando só parte do quadro.
 */
function graficosComoImagem(doc) {
  const Chart = window.Chart;
  if (!Chart) return;
  for (const canvas of doc.querySelectorAll('canvas')) {
    const chart = Chart.getChart(canvas);
    if (!chart) continue;
    const caixa = canvas.parentElement;
    const largura = caixa?.clientWidth || chart.width;
    const altura = caixa?.clientHeight || chart.height;
    const { type, data, options, plugins } = chart.config;
    chart.destroy();
    const copia = canvas.cloneNode(false); // mesmos atributos (dataset da fonte proporcional, aria-label)
    copia.removeAttribute('style');
    copia.width = largura;
    copia.height = altura;
    canvas.replaceWith(copia);
    const final = new Chart(copia, {
      type, data, plugins,
      options: { ...options, responsive: false, maintainAspectRatio: false, animation: false, devicePixelRatio: 3 },
    });
    const img = h('img', {
      class: 'imp-grafico', src: final.toBase64Image('image/png', 1), alt: copia.getAttribute('aria-label') ?? '',
      style: { width: `${largura}px`, height: `${altura}px` },
    });
    final.destroy();
    copia.replaceWith(img);
  }
}

/** Tabelas mais largas que a página são reduzidas (zoom) para caber na largura, sem cortar colunas. */
function ajustarTabelasALargura(doc) {
  for (const tabela of doc.querySelectorAll('.sheet > table')) {
    tabela.style.zoom = '';
    const livre = tabela.parentElement.clientWidth - 2;
    const fator = livre / tabela.offsetWidth;
    if (fator < 1) tabela.style.zoom = Math.max(0.4, fator).toFixed(3);
  }
}

async function esperarImagens(doc) {
  const imagens = [...doc.querySelectorAll('img')];
  for (const img of imagens) img.loading = 'eager';
  const carregada = (img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }));
  await Promise.race([Promise.all(imagens.map((img) => carregada(img).then(() => img.decode?.().catch(() => {})))), pausa(ESPERA_MAXIMA)]);
}

/** Texto para `content:` de uma regra CSS. */
const textoCss = (s) => `"${String(s).replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ')}"`;

/** Margens das páginas (mm): cabeçalho em cima, rodapé embaixo. A área útil da A4 paisagem é PAGINA. */
const MARGEM_MM = Object.freeze({ topo: 14, lados: 10, pe: 13 });
/** Folga (mm) na altura da folha do Resumo Geral, para arredondamentos não empurrarem nada para outra página. */
const FOLGA_FOLHA_GERAL_MM = 2;

/**
 * Cabeçalho e rodapé de cada página (margens da @page); a capa não tem margem nem cabeçalho.
 * v30: o Resumo Geral tem folha própria (`@page resumo-geral`): mesma largura da A4 paisagem e a altura exata da
 * grade + margens — ocupa a folha inteira sem esticar os quadros. As outras páginas continuam A4 paisagem.
 */
function regrasPagina(obra, referencia, alturaGeralMm = null) {
  const competencia = fmtMesLongo(referencia);
  const caixa = (conteudo, cor, peso = 500) => `content: ${conteudo}; font-family: Inter, sans-serif; font-size: 8.5pt; font-weight: ${peso}; color: ${cor};`;
  const tinta = token('--ink-600');
  const laranja = token('--color-primary');
  const hoje = new Date().toLocaleDateString('pt-BR');
  const folhaGeral = alturaGeralMm
    ? `\n@page resumo-geral { size: 297mm ${(MARGEM_MM.topo + MARGEM_MM.pe + alturaGeralMm + FOLGA_FOLHA_GERAL_MM).toFixed(1)}mm; }`
    : '';
  return `@page {
  size: A4 landscape;
  margin: ${MARGEM_MM.topo}mm ${MARGEM_MM.lados}mm ${MARGEM_MM.pe}mm;
  @top-left { ${caixa(textoCss(`${obra.nome}${obra.cliente ? ` · ${obra.cliente}` : ''}`), tinta, 600)} }
  @top-right { ${caixa(textoCss(`Competência: ${competencia.charAt(0).toUpperCase()}${competencia.slice(1)}`), laranja, 600)} }
  @bottom-left { ${caixa(textoCss(`Unità Engenharia · Apresentação ao cliente · gerado em ${hoje}`), tinta)} }
  @bottom-right { ${caixa('"Página " counter(page) " de " counter(pages)', tinta, 600)} }
}
@page capa {
  margin: 0;
  @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; }
}${folhaGeral}`;
}

function imprimir(doc, obra, referencia, alturaGeralMm = null) {
  const tituloAnterior = document.title;
  // O título vira o nome sugerido do arquivo em "Salvar como PDF".
  document.title = `Unità - ${obra.nome} - Apresentação ao cliente - ${referencia}`;
  const estilo = h('style', { id: 'impressao-pagina' }, regrasPagina(obra, referencia, alturaGeralMm));
  document.head.append(estilo);
  window.addEventListener('afterprint', () => {
    doc.remove();
    estilo.remove();
    document.title = tituloAnterior;
    document.body.classList.remove('imprimindo');
  }, { once: true });
  window.print();
}
