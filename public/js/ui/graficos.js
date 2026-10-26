/**
 * Gráficos (Chart.js, carregado em public/vendor). Cores lidas dos tokens CSS em tempo de execução;
 * grade só horizontal, eixos discretos, linhas de 2px, barras com cantos de 4px e tooltip no hover.
 * Cada gráfico tem legenda HTML própria (identidade nunca só pela cor) e tabela acessível (sr-only).
 */
import { h, montar, token } from '../core/dom.js';
import { fmtMes, fmtPercentual, VAZIO } from '../core/formato.js';

const instancias = new WeakMap();

/** Tamanho das legendas dos eixos acompanha a altura da tela (mais legível em telões e Full HD). */
const fonteEixo = () => (window.innerHeight >= 1000 ? 13 : 12);

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
        titleFont: { family: 'Inter', weight: '600', size: 13 },
        bodyFont: { family: 'Inter', size: 13 },
        padding: 12,
        cornerRadius: 10,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: { label: (c) => ` ${c.dataset.label}: ${c.raw === null ? VAZIO : percentual ? fmtPercentual(c.raw) : c.raw}` },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: token('--chart-grid') }, ticks: { color: eixo, font: { family: 'Inter', size: fonteEixo() - 1, weight: '500' }, autoSkip: false, maxRotation: 90, minRotation: 0 } }, // todos os meses; inclinados quando não cabem
      y: {
        beginAtZero: true,
        max: max ?? undefined,
        suggestedMax: minimoMax ?? undefined,
        grid: { color: token('--chart-grid'), drawTicks: false },
        border: { display: false, dash: [4, 4] },
        ticks: { color: eixo, font: { family: 'Inter', size: fonteEixo(), weight: '500' }, padding: 8, maxTicksLimit: 6, callback: (v) => (percentual ? fmtPercentual(v, 0) : v) },
      },
    },
  };
}

/**
 * Cria (ou recria) um gráfico dentro de `alvo`.
 * Gráficos de barras trazem o rótulo de dados (valor) em cada barra.
 * @param {{tipo: 'line'|'bar', meses: string[], series: Array<{rotulo, valores, cor, tracejada?, marcadores?}>, max?: number, minimoMax?: number, referencia?: string}} def
 */
export function grafico(alvo, def) {
  const Chart = window.Chart;
  if (!Chart) return montar(alvo, h('p', { class: 'muted' }, 'Biblioteca de gráficos indisponível.'));
  instancias.get(alvo)?.destroy();

  const tela = h('canvas', { role: 'img', 'aria-label': def.descricao ?? def.series.map((s) => s.rotulo).join(', ') });
  const caixa = h('div', { class: `grafico ${def.alto ? 'alto' : ''}` }, tela);
  montar(alvo, ...[legenda(def.series), caixa, tabelaAcessivel(def)].filter(Boolean));

  const datasets = def.series.map((s) => {
    const cor = token(s.cor);
    return def.tipo === 'bar'
      ? { label: s.rotulo, data: s.valores, backgroundColor: cor, hoverBackgroundColor: cor, borderRadius: 6, borderSkipped: 'start', maxBarThickness: 26, categoryPercentage: 0.72, barPercentage: 0.88 }
      : {
        label: s.rotulo, data: s.valores, borderColor: cor, backgroundColor: cor, borderWidth: s.tracejada ? 2 : 2.75, tension: 0.3, spanGaps: false,
        borderDash: s.tracejada ? [6, 5] : [], pointRadius: s.marcadores ? 3.5 : 0, pointHoverRadius: 6, pointBorderColor: token('--surface'), pointBorderWidth: 1.5,
      };
  });

  const opcoes = opcoesBase({ percentual: true, max: def.max, minimoMax: def.minimoMax });
  if (def.referencia) opcoes.plugins.linhaReferencia = { indice: def.meses.indexOf(def.referencia) };
  if (def.tipo === 'bar') { // espaço para o rótulo da barra mais alta (na vertical ele é mais comprido)
    opcoes.layout = { padding: { top: 22 } };
    opcoes.scales.y.grace = '12%';
  }
  const chart = new Chart(tela, {
    type: def.tipo,
    data: { labels: def.meses.map(fmtMes), datasets },
    options: opcoes,
    plugins: def.tipo === 'bar' ? [pluginReferencia, pluginRotulos] : [pluginReferencia],
  });
  instancias.set(alvo, chart);
  return chart;
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
const pluginRotulos = {
  id: 'rotulosBarras',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = `600 ${fonteEixo() - 2}px Inter, sans-serif`;
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
          ctx.save();
          ctx.translate(barra.x, barra.y - 3);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(texto, 0, 0);
          ctx.restore();
        }
      });
    });
    ctx.restore();
  },
};

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
