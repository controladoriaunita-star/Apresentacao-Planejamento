/**
 * Gráficos (Chart.js, carregado em public/vendor). Cores lidas dos tokens CSS em tempo de execução;
 * grade só horizontal, eixos discretos, linhas de 2px, barras com cantos de 4px e tooltip no hover.
 * Cada gráfico tem legenda HTML própria (identidade nunca só pela cor) e tabela acessível (sr-only).
 */
import { h, montar, token } from '../core/dom.js';
import { fmtMes, fmtPercentual, VAZIO } from '../core/formato.js';

const instancias = new WeakMap();

/**
 * v29 — Fonte dos gráficos com reserva do sistema: se a Inter (Google Fonts) não carregar, Windows e Mac usam
 * fontes de largura parecida em vez da serifada padrão. Os gráficos são redesenhados quando as fontes carregam.
 */
const FAMILIA = 'Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

/** Tamanho das legendas dos eixos acompanha a altura da tela (mais legível em telões e Full HD). */
const fonteEixo = () => (window.innerHeight >= 1000 ? 13 : 12);

/**
 * v27 — Gráficos com `fonteProporcional` (quadros do Resumo Geral): a fonte acompanha o tamanho do próprio
 * gráfico, entre 10 e 16 px, para o quadro redimensionado continuar legível e sem rótulos encavalados.
 * v28 — Também cabe no espaço de cada mês ("MAR" em uma linha, sem inclinar): com muitos meses num gráfico
 * estreito a fonte desce até 8 px em vez de os meses inclinarem e se sobreporem.
 */
const fonteDoGrafico = (chart) => {
  if (!chart?.canvas?.dataset.fonteProporcional) return fonteEixo();
  const meses = Math.max(1, chart.data?.labels?.length ?? 1);
  const porMes = (chart.width * 0.9) / meses / 2.4; // ~2,4 em = largura de "MAR" com folga
  // v29: no Resumo Geral a fonte é a global da tela (--fonte-rg), limitada só pelo espaço de cada mês.
  const global = parseFloat(chart.canvas.closest('.rg-tela')?.style.getPropertyValue('--fonte-rg'));
  // v31: escala do quadro (A− / A+ do Dev); o espaço de cada mês continua limitando, para os meses não se encavalarem.
  const escala = chart.canvas.closest('.com-escala') ? parseFloat(chart.canvas.closest('.rg-cartao')?.style.getPropertyValue('--escala-fonte')) || 1 : 1;
  if (global > 0) return Math.round(Math.max(8, Math.min(global * escala, porMes, (chart.height / 10) * escala)) * 2) / 2;
  // v29: até 20 px em gráficos grandes (telões, 2560 px), acompanhando o texto dos quadros.
  const tamanho = Math.min(20, Math.max(10, Math.min(chart.height / 14, chart.width / 45)), porMes);
  return Math.round(Math.max(8, tamanho) * 2) / 2;
};

/** v28 — Fonte dos rótulos de dados: menor que a dos eixos e, se possível, cabendo na horizontal entre dois pontos. */
const fonteRotulo = (chart, passo) => {
  if (!chart?.canvas?.dataset.fonteProporcional) return fonteDoGrafico(chart) - 2;
  const base = Math.round(fonteDoGrafico(chart) * 0.85); // v31: 85% da fonte do gráfico, em negrito (antes 70%)
  // v29: na tela, nunca abaixo de 9 px (se não couber na horizontal, o rótulo fica na vertical); no PDF, 7 px.
  const minimo = chart.canvas.closest('.impressao') ? 7 : 9;
  const deitado = Math.floor(passo / 3.6); // "100,0%" ≈ 3,4 em
  if (deitado >= base * 0.8) return Math.max(minimo, Math.min(base, deitado));
  // v31: não cabe deitado → o rótulo vai na vertical, onde o limite é a altura da letra (não o comprimento do texto).
  return Math.max(minimo, Math.min(base, Math.floor(passo * 0.9)));
};

/** v31: rótulos de dados em negrito nos gráficos do Resumo Geral. */
const pesoRotulo = (chart) => (chart?.canvas?.dataset.fonteProporcional ? 700 : 600);

function opcoesBase({ percentual = true, max = null, minimoMax = null } = {}) {
  const eixo = token('--chart-axis');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: token('--ink-900'),
        titleFont: { family: FAMILIA, weight: '600', size: 13 },
        bodyFont: { family: FAMILIA, size: 13 },
        padding: 12,
        cornerRadius: 10,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: { label: (c) => ` ${c.dataset.label}: ${c.raw === null ? VAZIO : percentual ? fmtPercentual(c.raw) : c.raw}` },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: token('--chart-grid') }, ticks: { color: eixo, font: { family: FAMILIA, size: fonteEixo() - 1, weight: '500' }, autoSkip: false, maxRotation: 90, minRotation: 0 } }, // todos os meses; inclinados quando não cabem
      y: {
        beginAtZero: true,
        max: max ?? undefined,
        suggestedMax: minimoMax ?? undefined,
        grid: { color: token('--chart-grid'), drawTicks: false },
        border: { display: false, dash: [4, 4] },
        ticks: { color: eixo, font: { family: FAMILIA, size: fonteEixo(), weight: '500' }, padding: 8, maxTicksLimit: 6, callback: (v) => (percentual ? fmtPercentual(v, 0) : v) },
      },
    },
  };
}

/**
 * Cria (ou recria) um gráfico dentro de `alvo`.
 * Gráficos de barras trazem o rótulo de dados (valor) em cada barra; nas linhas, as séries com `rotulos`.
 * @param {{tipo: 'line'|'bar', meses: string[], series: Array<{rotulo, valores, cor, tracejada?, marcadores?, rotulos?: 'acima'|'abaixo'}>, max?: number, minimoMax?: number, referencia?: string}} def
 */
export function grafico(alvo, def) {
  const Chart = window.Chart;
  if (!Chart) return montar(alvo, h('p', { class: 'muted' }, 'Biblioteca de gráficos indisponível.'));
  instancias.get(alvo)?.destroy();

  const tela = h('canvas', { role: 'img', 'aria-label': def.descricao ?? def.series.map((s) => s.rotulo).join(', ') });
  if (def.fonteProporcional) tela.dataset.fonteProporcional = '1';
  const caixa = h('div', { class: `grafico ${def.alto ? 'alto' : ''}` }, tela);
  montar(alvo, ...[legenda(def.series), caixa, tabelaAcessivel(def)].filter(Boolean));

  const datasets = def.series.map((s) => {
    const cor = token(s.cor);
    return def.tipo === 'bar'
      ? { label: s.rotulo, data: s.valores, backgroundColor: cor, hoverBackgroundColor: cor, borderRadius: 6, borderSkipped: 'start', maxBarThickness: 26, categoryPercentage: 0.72, barPercentage: 0.88 }
      : {
        label: s.rotulo, data: s.valores, borderColor: cor, backgroundColor: cor, borderWidth: s.tracejada ? 2 : 2.75, tension: 0.3, spanGaps: false, rotulos: s.rotulos ?? null,
        borderDash: s.tracejada ? [6, 5] : [], pointRadius: s.marcadores ? 3.5 : 0, pointHoverRadius: 6, pointBorderColor: token('--surface'), pointBorderWidth: 1.5,
      };
  });

  const opcoes = opcoesBase({ percentual: true, max: def.max, minimoMax: def.minimoMax });
  if (def.fonteProporcional) {
    // v31: eixos maiores e em negrito no Resumo Geral (antes 500 e x um ponto menor que y).
    const fonte = (delta) => (ctx) => ({ family: FAMILIA, weight: '700', size: fonteDoGrafico(ctx.chart) + delta });
    opcoes.scales.x.ticks.font = fonte(0);
    opcoes.scales.y.ticks.font = fonte(1);
    opcoes.scales.x.ticks.maxRotation = 0; // v28: mês em duas linhas nunca inclina (inclinado, se encavalava)
  }
  opcoes.plugins.tooltip.callbacks.title = (itens) => fmtMes(def.meses[itens[0]?.dataIndex]);
  if (def.referencia) opcoes.plugins.linhaReferencia = { indice: def.meses.indexOf(def.referencia) };
  const comRotulos = def.tipo === 'bar' || def.series.some((s) => s.rotulos);
  if (comRotulos) { // espaço para o rótulo mais alto (na vertical ele é mais comprido) e para o último rótulo à direita
    opcoes.layout = { padding: { top: 22, right: def.fonteProporcional ? 14 : 0, left: def.fonteProporcional ? 4 : 0 } };
    opcoes.scales.y.grace = '12%';
  }
  if (def.fonteProporcional && !def.max) {
    // v29: topo do eixo = maior valor + 15% (arredondado), em vez do "número redondo" do Chart.js — num gráfico
    // baixo ele saltava para 200% e os dados ocupavam só metade da altura.
    const maior = Math.max(def.minimoMax ?? 0, ...def.series.flatMap((s) => s.valores).filter((v) => typeof v === 'number'));
    if (maior > 0) {
      const passo = maior > 0.2 ? 0.1 : 0.01;
      opcoes.scales.y.max = Math.ceil((maior * 1.15) / passo) * passo;
      delete opcoes.scales.y.grace;
    }
  }
  const chart = new Chart(tela, {
    type: def.tipo,
    // Mês em duas linhas ("JAN" sobre "25"): metade da largura, todos os meses cabem sem inclinar.
    data: { labels: def.meses.map((m) => fmtMes(m).split('/')), datasets },
    options: opcoes,
    plugins: [pluginReferencia, def.tipo === 'bar' ? pluginRotulosBarras : pluginRotulosLinha],
  });
  instancias.set(alvo, chart);
  redesenharComFontes(chart);
  return chart;
}

/** v29: redesenha o gráfico quando as fontes da página terminam de carregar (medidas de texto corretas). */
function redesenharComFontes(chart) {
  if (!document.fonts || document.fonts.status === 'loaded') return;
  document.fonts.ready.then(() => { if (chart.canvas?.isConnected) chart.update('none'); });
}

/** Linha vertical tracejada no mês de referência. */
const pluginReferencia = {
  id: 'linhaReferencia',
  afterDatasetsDraw(chart, _args, opcoes) {
    const i = opcoes?.indice;
    if (i === undefined || i < 0) return;
    const x = chart.scales.x.getPixelForValue(i);
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = token('--color-primary');
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

/**
 * Rótulo de dados das barras: valor acima de cada barra; quando a barra é mais estreita que o texto
 * (muitos meses na tela), o rótulo fica na vertical.
 */
/** v29: rótulos de dados só quando a área do gráfico tem altura para eles (no "Detalhe" a tabela traz os valores). */
const ALTURA_MINIMA_ROTULOS = 70;
// No PDF os rótulos ficam sempre (lá não existe o "Detalhe" para consultar os valores).
const semEspacoParaRotulos = (chart) => chart.canvas?.dataset.fonteProporcional && !chart.canvas.closest('.impressao')
  && chart.chartArea && (chart.chartArea.bottom - chart.chartArea.top) < ALTURA_MINIMA_ROTULOS;

const pluginRotulosBarras = {
  id: 'rotulosBarras',
  afterDatasetsDraw(chart) {
    if (semEspacoParaRotulos(chart)) return;
    const ctx = chart.ctx;
    ctx.save();
    const meta0 = chart.getDatasetMeta(0);
    const passo = meta0?.data?.length > 1 ? Math.abs(meta0.data[1].x - meta0.data[0].x) / Math.max(1, chart.data.datasets.length) : Infinity;
    ctx.font = `${pesoRotulo(chart)} ${fonteRotulo(chart, passo)}px ${FAMILIA}`;
    ctx.fillStyle = token('--ink-700');
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      meta.data.forEach((barra, j) => {
        const v = ds.data[j];
        if (typeof v !== 'number') return;
        const texto = fmtPercentual(v, 1);
        const largura = ctx.measureText(texto).width;
        if (largura + 2 <= barra.width) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(texto, barra.x, barra.y - 3);
        } else {
          // v31: se o rótulo vertical passaria do topo do quadro, ele vai dentro da barra (em branco).
          const dentro = barra.y - 3 - largura < 0 && Math.abs(barra.base - barra.y) >= largura + 6;
          ctx.save();
          ctx.translate(barra.x, dentro ? barra.y + 4 : barra.y - 3);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = dentro ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          if (dentro) ctx.fillStyle = token('--color-primary-foreground');
          ctx.fillText(texto, 0, 0);
          ctx.restore();
        }
      });
    });
    ctx.restore();
  },
};

/**
 * Rótulo de dados das linhas com `rotulos: 'acima' | 'abaixo'` (série a série, para não se sobreporem):
 * valor junto de cada ponto; na vertical quando os pontos estão mais próximos que o tamanho do texto.
 */
const pluginRotulosLinha = {
  id: 'rotulosLinha',
  afterDatasetsDraw(chart) {
    if (semEspacoParaRotulos(chart)) return;
    const ctx = chart.ctx;
    ctx.save();
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (!ds.rotulos || meta.hidden) return;
      const abaixo = ds.rotulos === 'abaixo';
      const passo = meta.data.length > 1 ? Math.abs(meta.data[1].x - meta.data[0].x) : Infinity;
      ctx.font = `${pesoRotulo(chart)} ${fonteRotulo(chart, passo)}px ${FAMILIA}`;
      ctx.fillStyle = ds.borderColor;
      meta.data.forEach((ponto, j) => {
        const v = ds.data[j];
        if (typeof v !== 'number') return;
        const texto = fmtPercentual(v, 1);
        const y = abaixo ? ponto.y + 6 : ponto.y - 6;
        if (ctx.measureText(texto).width + 2 <= passo) {
          ctx.textAlign = 'center';
          ctx.textBaseline = abaixo ? 'top' : 'bottom';
          ctx.fillText(texto, ponto.x, y);
        } else {
          ctx.save();
          ctx.translate(ponto.x, y);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = abaixo ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(texto, 0, 0);
          ctx.restore();
        }
      });
    });
    ctx.restore();
  },
};

/**
 * Gráfico de categorias (contagens) — Segurança do Trabalho. Mesmo visual dos demais (opcoesBase), com:
 * barras verticais ou horizontais, empilhadas por série, linha opcional e o valor escrito em cada barra/ponto
 * (como os gráficos da planilha de referência).
 * @param {{tipo?: 'bar'|'line', horizontal?: boolean, empilhado?: boolean, categorias: string[],
 *          series: Array<{rotulo, valores, cor}>, descricao?: string, legendaSempre?: boolean}} def
 */
export function graficoCategorias(alvo, def) {
  const Chart = window.Chart;
  if (!Chart) return montar(alvo, h('p', { class: 'muted' }, 'Biblioteca de gráficos indisponível.'));
  instancias.get(alvo)?.destroy();
  const tipo = def.tipo ?? 'bar';
  const tela = h('canvas', { role: 'img', 'aria-label': def.descricao ?? def.series.map((s) => s.rotulo).join(', ') });
  const caixa = h('div', { class: 'grafico' }, tela);
  const legendaCategorias = def.coresCategorias ? legendaSempre(def.categorias.map((c, i) => ({ rotulo: def.rotulosLegenda?.[i] ?? c, cor: def.coresCategorias[i] }))) : null;
  montar(alvo, ...[legendaCategorias ?? (def.legendaSempre || def.series.length > 1 ? legendaSempre(def.series) : null), caixa, tabelaCategorias(def)].filter(Boolean));

  // `espessura`: multiplica a grossura máxima das barras (Dashboard Segurança usa 2 = o dobro).
  const espessura = def.espessura ?? 1;
  const datasets = def.series.map((s) => {
    // `coresCategorias`: uma cor por barra (ex.: classificação do acidente com as cores de cada tipo).
    const cor = def.coresCategorias ? def.coresCategorias.map(token) : token(s.cor);
    return tipo === 'bar'
      ? {
        label: s.rotulo, data: s.valores, backgroundColor: cor, hoverBackgroundColor: cor, borderRadius: def.empilhado ? 3 : 6 * espessura, borderSkipped: def.empilhado ? false : 'start',
        maxBarThickness: (def.horizontal ? 22 : 34) * espessura, categoryPercentage: espessura > 1 ? 0.9 : 0.78, barPercentage: espessura > 1 ? 0.94 : 0.9,
      }
      : { label: s.rotulo, data: s.valores, borderColor: cor, backgroundColor: token('--color-primary-soft'), fill: Boolean(def.area), borderWidth: 2.75, tension: 0, pointRadius: 4, pointBackgroundColor: cor, pointHoverRadius: 6, pointBorderColor: token('--surface'), pointBorderWidth: 1.5 };
  });
  const opcoes = opcoesBase({ percentual: false });
  const eixoValor = def.horizontal ? 'x' : 'y';
  const eixoCategoria = def.horizontal ? 'y' : 'x';
  opcoes.indexAxis = def.horizontal ? 'y' : 'x';
  opcoes.interaction = { mode: 'index', intersect: false, axis: eixoCategoria };
  opcoes.layout = { padding: { top: def.horizontal ? 0 : 18, right: def.horizontal ? 28 : 4 } };
  opcoes.plugins.tooltip.callbacks = { label: (c) => ` ${c.dataset.label}: ${c.raw ?? VAZIO}` };
  const valor = opcoes.scales.y;
  const categoria = opcoes.scales.x;
  // `fonte`: tamanho (px) dos rótulos dos eixos e dos valores escritos nas barras.
  const fonte = def.fonte ? { family: FAMILIA, size: def.fonte, weight: '600' } : null;
  valor.ticks = { ...valor.ticks, precision: 0, callback: (v) => v, ...(fonte ? { font: fonte } : {}) };
  // `max`: topo fixo do eixo de valores (Segurança do Trabalho: maior mês + 2). Com teto inteiro, passo 1.
  if (def.max) { valor.max = def.max; valor.ticks.stepSize = def.max <= 12 ? 1 : undefined; valor.ticks.maxTicksLimit = 13; }
  categoria.ticks = { ...categoria.ticks, autoSkip: !def.horizontal, maxRotation: def.horizontal ? 0 : 50, ...(fonte ? { font: fonte } : {}) };
  if (fonte) opcoes.layout.padding = { top: def.horizontal ? 0 : def.fonte + 12, right: def.horizontal ? def.fonte * 2 + 12 : 4 };
  opcoes.scales = {
    [eixoValor]: { ...valor, stacked: Boolean(def.empilhado), grid: { ...valor.grid, display: !def.horizontal }, ...(def.horizontal ? { border: { display: false }, ticks: { ...valor.ticks, display: false } } : {}) },
    [eixoCategoria]: { ...categoria, stacked: Boolean(def.empilhado) },
  };
  opcoes.plugins.rotulosValor = { empilhado: Boolean(def.empilhado), horizontal: Boolean(def.horizontal), fonte: def.fonte ?? null };
  const chart = new Chart(tela, { type: tipo, data: { labels: def.categorias, datasets }, options: opcoes, plugins: [pluginRotulos] });
  instancias.set(alvo, chart);
  return chart;
}

/** Escreve o valor em cada barra/ponto (zeros ficam sem rótulo, como no Excel). */
const pluginRotulos = {
  id: 'rotulosValor',
  afterDatasetsDraw(chart, _args, opcoes) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = opcoes?.fonte ? `700 ${opcoes.fonte}px ${FAMILIA}` : `600 ${fonteEixo()}px ${FAMILIA}`;
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      meta.data.forEach((el, j) => {
        const v = ds.data[j];
        if (!v) return;
        const { x, y } = el.tooltipPosition();
        if (opcoes?.empilhado) {
          ctx.fillStyle = token('--surface');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const props = el.getProps(['x', 'y', 'base'], true);
          const meio = opcoes.horizontal ? [(props.x + props.base) / 2, props.y] : [props.x, (props.y + props.base) / 2];
          ctx.fillText(String(v), meio[0], meio[1]);
        } else if (opcoes?.horizontal) {
          ctx.fillStyle = token('--ink-800');
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(v), x + 8, y);
        } else {
          ctx.fillStyle = token('--ink-800');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(v), x, y - 6);
        }
      });
    });
    ctx.restore();
  },
};

function legendaSempre(series) {
  return h('div', { class: 'legenda' }, series.map((s) => h('span', {}, h('i', { style: { background: `var(${s.cor})` } }), s.rotulo)));
}

function tabelaCategorias(def) {
  return h('table', { class: 'sr-only' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Categoria'), def.series.map((s) => h('th', {}, s.rotulo)))),
    h('tbody', {}, def.categorias.map((c, i) => h('tr', {}, h('td', {}, c), def.series.map((s) => h('td', {}, s.valores[i] ?? VAZIO))))));
}

function legenda(series) {
  if (series.length < 2) return null;
  return h('div', { class: 'legenda' }, series.map((s) => h('span', {},
    h('i', { class: s.tracejada ? 'tracejada' : s.linha ? 'linha' : '', style: s.tracejada ? { borderColor: `var(${s.cor})` } : { background: `var(${s.cor})` } }),
    s.rotulo)));
}

function tabelaAcessivel(def) {
  return h('table', { class: 'sr-only' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Mês'), def.series.map((s) => h('th', {}, s.rotulo)))),
    h('tbody', {}, def.meses.map((m, i) => h('tr', {}, h('td', {}, fmtMes(m)), def.series.map((s) => h('td', {}, fmtPercentual(s.valores[i])))))));
}
