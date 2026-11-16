/**
 * v29 — "Detalhe" de um gráfico do Resumo Geral: o gráfico em tela cheia com, à esquerda, a tabela das curvas
 * mês a mês (cresce na vertical e rola; o mês de referência fica destacado e visível ao abrir).
 * Fecha com Esc ou "Fechar". Usa a mesma definição do gráfico do quadro (ui/graficos.js).
 */
import { h } from '../core/dom.js';
import { fmtMes, fmtPercentual, VAZIO } from '../core/formato.js';
import { grafico } from './graficos.js';
import { icone } from './icones.js';

/**
 * @param {{ titulo: string, def: { tipo: 'line'|'bar', meses: string[], series: Array<{ rotulo: string, valores: Array<number|null> }>, referencia?: string } }} opcoes
 */
export function abrirDetalheGrafico({ titulo, def }) {
  const anterior = document.activeElement;
  const valor = (v) => (typeof v === 'number' ? fmtPercentual(v, 1) : VAZIO);
  const linhaReferencia = def.meses.indexOf(def.referencia);
  const tabela = h('div', { class: 'detalhe-grafico-tabela sheet' }, h('table', { 'aria-label': `${titulo} — valores por mês` },
    h('thead', {}, h('tr', {}, h('th', { class: 'esq' }, 'Mês'), def.series.map((s) => h('th', {}, s.rotulo)))),
    h('tbody', {}, def.meses.map((m, i) => h('tr', { class: i === linhaReferencia ? 'referencia' : '' },
      h('td', { class: 'esq' }, fmtMes(m), i === linhaReferencia ? h('small', {}, 'referência') : null),
      def.series.map((s) => h('td', {}, valor(s.valores[i]))))))));
  const area = h('div', { class: 'detalhe-grafico-area grafico-area' });

  const fechar = () => {
    painel.remove();
    document.removeEventListener('keydown', tecla);
    anterior?.focus?.();
  };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  const painel = h('div', { class: 'detalhe-grafico', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Detalhe: ${titulo}`, 'data-teste': 'detalhe-grafico' },
    h('div', { class: 'detalhe-grafico-topo' },
      h('h2', {}, titulo),
      h('button', { class: 'btn secondary sm', type: 'button', onclick: fechar }, icone('x', { tamanho: 16 }), 'Fechar')),
    h('div', { class: 'detalhe-grafico-corpo' }, tabela, h('div', { class: 'card detalhe-grafico-cartao' }, area)));
  document.addEventListener('keydown', tecla);
  document.body.append(painel);
  grafico(area, { ...def, fonteProporcional: true });
  tabela.querySelector('tr.referencia')?.scrollIntoView({ block: 'center' });
  painel.querySelector('button').focus();
}
