/**
 * Peças de tela da simulação "Resumo Físico sem atividades": painel comparativo (oficial × simulado) e o
 * texto da linha simulada. O cálculo fica em domain/simulacao-fisico.js.
 */
import { h } from '../core/dom.js';
import { classeSinal, fmtPercentual, fmtVariacao } from '../core/formato.js';
import { desvioDaMeta } from '../domain/simulacao-fisico.js';
import { card, cardTitulo } from './componentes.js';
import { icone } from './icones.js';

/** Indicadores comparados no painel: [rótulo, valor da linha, é desvio (com sinal)?]. */
const INDICADORES = [
  ['Realizado acm', (l) => l.realizadoAcm, false],
  ['Planejado acm (meta)', (l) => l.planejadoAcm, false],
  ['Desvio da meta', desvioDaMeta, true],
  ['Cronograma', (l) => l.cronograma, false],
  ['Adiant. × cronograma', (l) => l.adiantamento, true],
  ['% acerto do mês', (l) => l.acerto, false],
];

const pct = (v, desvio) => (desvio ? fmtVariacao(v, 1) : fmtPercentual(v, 1));
const nomeItem = (l) => `${l.item} ${l.descricao ?? ''}`.trim();

/**
 * @param {object} total  linha oficial da obra
 * @param {ReturnType<import('../domain/simulacao-fisico.js').simularSemItens>} simulacao
 * @param {() => void} aoLimpar  desmarca todas as atividades retiradas
 */
export function painelSimulacao(total, simulacao, aoLimpar) {
  const titulo = cardTitulo('Simulação sem atividades', h('div', { class: 'row' },
    h('span', { class: 'muted small' }, 'não altera os dados oficiais'),
    simulacao ? h('button', { class: 'btn ghost sm', type: 'button', onclick: aoLimpar }, icone('x', { tamanho: 16 }), 'Limpar') : null));
  if (!simulacao) {
    return card({ class: 'card-pad simulacao-painel' }, titulo,
      h('p', { class: 'simulacao-dica' }, icone('check', { tamanho: 16 }), 'Marque na tabela as atividades que deseja retirar do resumo da obra.'));
  }
  const { itens, pesoRetirado, linha } = simulacao;
  return card({ class: 'card-pad simulacao-painel' }, titulo,
    h('p', { class: 'simulacao-retiradas' },
      h('span', { class: 'muted' }, `Sem ${itens.length === 1 ? 'a atividade' : `${itens.length} atividades`} (${fmtPercentual(pesoRetirado, 1)} do orçamento):`),
      itens.map((l) => h('span', { class: 'badge b-primary' }, nomeItem(l)))),
    linha
      ? h('div', { class: 'simulacao-indicadores' }, INDICADORES.map(([rotulo, valor, desvio]) => {
        const oficial = valor(total);
        const simulado = valor(linha);
        return h('div', { class: 'simulacao-indicador' },
          h('span', { class: 'l' }, rotulo),
          h('span', { class: `v ${desvio ? classeSinal(simulado) : ''}` }, pct(simulado, desvio)),
          h('span', { class: 'h' }, `oficial ${pct(oficial, desvio)}`));
      }))
      : h('p', { class: 'simulacao-dica' }, 'Todas as atividades com orçamento foram retiradas: não sobra nada para calcular.'));
}

/** Primeira célula da linha simulada na tabela. */
export function rotuloLinhaSimulada(simulacao) {
  if (!simulacao) return [h('b', {}, 'Simulação'), h('small', {}, 'marque as atividades a retirar')];
  return [h('b', {}, 'Simulação'), h('small', {}, `sem ${simulacao.itens.map(nomeItem).join(', ')}`)];
}
