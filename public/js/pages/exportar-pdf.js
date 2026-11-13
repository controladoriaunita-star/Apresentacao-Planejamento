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
import { ajustarQuadros, FONTE_QUADRO } from './resumo-geral.js';
import { fonteDoGrafico } from '../ui/graficos.js';

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
    recolherTabelas(doc);
    const geral = doc.querySelector('[data-secao="resumo-geral"] > div');
    if (geral) enquadrarResumoGeral(geral);
    graficosComoImagem(doc);
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
  imprimir(doc, obra, referencia);
}

// ── Seções ─────────────────────────────────────────────────────────────
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
    h('div', { class: 'imp-capa-kpis' },
      indicador('Avanço físico realizado', fmtPercentual(info?.realizadoAcm, 1), 'acumulado até o mês'),
      indicador('Planejado acumulado', fmtPercentual(info?.replanAcm, 1), 'cronograma atual'),
      indicador('Desvio', fmtVariacao(desvio, 1), desvio === null ? null : desvio >= 0 ? 'adiantado em relação ao planejado' : 'atrasado em relação ao planejado')),
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
  await document.fonts?.ready; // medir os quadros do Resumo Geral só com a fonte da marca já carregada
}

/** Físico e Econômico como abrem na tela: só os itens principais (sem subitens e sem detalhes); sem a simulação. */
function recolherTabelas(doc) {
  for (const tr of doc.querySelectorAll('tr[data-filho-de], tr.detalhe')) tr.classList.add('oculto');
  for (const planilha of doc.querySelectorAll('.sheet.simulando')) planilha.classList.remove('simulando');
  for (const area of doc.querySelectorAll('.simulacao-area')) area.replaceChildren();
}

/**
 * Resumo Geral numa página com a menor redução possível: a grade é montada no tamanho da página e cada quadro
 * ajusta fonte e arranjo ao próprio tamanho (v27, como na tela). Só se algum quadro não couber nem na fonte
 * mínima a área cresce (na proporção da página) e o zoom a traz de volta à largura da página. Os gráficos se
 * ajustam a qualquer tamanho e não entram na conta.
 */
function enquadrarResumoGeral(alvo) {
  const rg = alvo.querySelector('.rg.rg-tela');
  if (!rg) return;
  const cortado = (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  let largura = Math.floor(PAGINA.largura);
  for (; largura <= 1800; largura += 40) {
    alvo.style.width = `${largura}px`;
    rg.style.height = `${Math.floor(largura * (PAGINA.altura / PAGINA.largura))}px`;
    const couberam = ajustarQuadros(rg, FONTE_QUADRO.impressao);
    if (couberam && ![...rg.querySelectorAll('.rg-cartao:not(.rg-grafico)')].some(cortado)) break;
  }
  alvo.style.zoom = Math.min(1, PAGINA.largura / largura).toFixed(4);
  alvo.dataset.zoom = alvo.style.zoom;
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
 * v30 — Gráficos mês a mês do Resumo Geral no PDF: a página A4 é mais estreita que a tela, então na fonte da
 * tela os meses do eixo inclinavam e se encavalavam ("24SET 24OUT…"), e os rótulos de valor também. Aqui a
 * fonte desce até todos os meses caberem lado a lado sem inclinar (mínimo legível de 6,5 px), e os três
 * gráficos ficam com a mesma fonte (a menor delas), como na tela.
 */
const FONTE_MINIMA_PDF = 6.5;
function fonteQueCabeNosMeses(chart) {
  const meses = chart.data.labels ?? [];
  if (!meses.length) return null;
  const ctx = chart.ctx;
  const larguraMaior = (fonte) => {
    ctx.save();
    ctx.font = `500 ${fonte - 1}px Inter, sans-serif`; // rótulo do eixo x = fonte − 1 (ui/graficos.js)
    const w = Math.max(...meses.flat().map((t) => ctx.measureText(String(t)).width));
    ctx.restore();
    return w;
  };
  const porMes = chart.chartArea.width / meses.length;
  let fonte = fonteDoGrafico(chart);
  while (fonte > FONTE_MINIMA_PDF && larguraMaior(fonte) + 8 > porMes) fonte -= 0.5;
  return fonte;
}

function ajustarFonteDosGraficos(doc) {
  const Chart = window.Chart;
  const graficos = [...doc.querySelectorAll('canvas[data-fonte-proporcional]')].map((c) => Chart.getChart(c)).filter(Boolean);
  if (!graficos.length) return;
  for (const chart of graficos) { chart.options.animation = false; chart.update('none'); }
  const fontes = graficos.map(fonteQueCabeNosMeses).filter((f) => f !== null);
  if (!fontes.length) return;
  const fonte = Math.min(...fontes);
  for (const chart of graficos) chart.canvas.dataset.fonteFixa = String(fonte);
}

/** Cada gráfico Chart.js vira uma imagem no mesmo tamanho, desenhada em 3× (nítida na impressão). */
function graficosComoImagem(doc) {
  const Chart = window.Chart;
  if (!Chart) return;
  ajustarFonteDosGraficos(doc);
  for (const canvas of doc.querySelectorAll('canvas')) {
    const chart = Chart.getChart(canvas);
    if (!chart) continue;
    chart.stop();
    chart.options.animation = false;
    chart.options.devicePixelRatio = 3;
    chart.resize();
    chart.update('none');
    // Tamanho em px de CSS que o Chart.js deu ao canvas (sem o zoom do Resumo Geral, que vale para a imagem também).
    const img = h('img', {
      class: 'imp-grafico', src: chart.toBase64Image('image/png', 1), alt: canvas.getAttribute('aria-label') ?? '',
      style: { width: canvas.style.width, height: canvas.style.height },
    });
    chart.destroy();
    canvas.replaceWith(img);
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

/** Cabeçalho e rodapé de cada página (margens da @page); a capa não tem margem nem cabeçalho. */
function regrasPagina(obra, referencia) {
  const competencia = fmtMesLongo(referencia);
  const caixa = (conteudo, cor, peso = 500) => `content: ${conteudo}; font-family: Inter, sans-serif; font-size: 8.5pt; font-weight: ${peso}; color: ${cor};`;
  const tinta = token('--ink-600');
  const laranja = token('--color-primary');
  const hoje = new Date().toLocaleDateString('pt-BR');
  return `@page {
  size: A4 landscape;
  margin: 14mm 10mm 13mm;
  @top-left { ${caixa(textoCss(`${obra.nome}${obra.cliente ? ` · ${obra.cliente}` : ''}`), tinta, 600)} }
  @top-right { ${caixa(textoCss(`Competência: ${competencia.charAt(0).toUpperCase()}${competencia.slice(1)}`), laranja, 600)} }
  @bottom-left { ${caixa(textoCss(`Unità Engenharia · Apresentação ao cliente · gerado em ${hoje}`), tinta)} }
  @bottom-right { ${caixa('"Página " counter(page) " de " counter(pages)', tinta, 600)} }
}
@page capa {
  margin: 0;
  @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; }
}`;
}

function imprimir(doc, obra, referencia) {
  const tituloAnterior = document.title;
  // O título vira o nome sugerido do arquivo em "Salvar como PDF".
  document.title = `Unità - ${obra.nome} - Apresentação ao cliente - ${referencia}`;
  const estilo = h('style', { id: 'impressao-pagina' }, regrasPagina(obra, referencia));
  document.head.append(estilo);
  window.addEventListener('afterprint', () => {
    doc.remove();
    estilo.remove();
    document.title = tituloAnterior;
    document.body.classList.remove('imprimindo');
  }, { once: true });
  window.print();
}
