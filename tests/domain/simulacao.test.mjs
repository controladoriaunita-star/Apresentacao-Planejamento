/**
 * Simulação do Resumo Físico sem atividades: retirar um item redistribui o peso (orçamento) entre os demais.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perto } from './apoio.mjs';
import { desvioDaMeta, simularSemItens } from '../../public/js/domain/simulacao-fisico.js';

/** Linha com o mesmo valor em todos os percentuais (o suficiente para conferir a ponderação). */
const linha = (item, nivel, orcamento, valor, extras = {}) => ({
  item, nivel, orcamento,
  realizadoAcm: valor, realizadoMes: valor / 10, planejadoInicial: valor, planejadoAcm: valor, planejadoMes: valor / 10, cronograma: valor,
  proximo: { planejadoMes: valor / 10, planejadoAcm: valor, previsto: valor },
  economico: nivel === 1 ? { orcamentoProjetado: orcamento * 1.1 } : null,
  ...extras,
});

// Total = (100 × 1,0 + 300 × 0,4) ÷ 400 = 0,55
const RESUMO = {
  total: { ...linha('Geral', 0, 400, 0.55), economico: { orcamentoProjetado: 440 } },
  linhas: [
    linha('01', 1, 100, 1),
    linha('02', 1, 300, 0.4),
    linha('02.01', 2, 100, 0.1),
    linha('02.02', 2, 200, 0.55),
    linha('03', 1, null, 0.9),
  ],
};

test('Simulação — sem nada retirado não há simulação', () => {
  assert.equal(simularSemItens(RESUMO, new Set()), null);
  assert.equal(simularSemItens(RESUMO, new Set(['03'])), null, 'item sem orçamento não tem peso');
});

test('Simulação — retirar um item pai deixa só os demais', () => {
  const s = simularSemItens(RESUMO, new Set(['01']));
  perto(assert, s.pesoRetirado, 0.25, 'peso retirado');
  perto(assert, s.linha.realizadoAcm, 0.4, 'realizado acumulado = o do item que sobrou');
  perto(assert, s.linha.proximo.previsto, 0.4, 'mês seguinte também');
  perto(assert, s.linha.acerto, 1, '% acerto = realizado mês ÷ planejado mês simulados');
  perto(assert, s.linha.adiantamento, 0, 'adiantamento = realizado − cronograma simulados');
  assert.equal(s.linha.orcamento, 300);
  perto(assert, s.linha.economico.orcamentoProjetado, 330, 'orçamento projetado sem o item');
});

test('Simulação — retirar um filho pondera pelo orçamento dele', () => {
  const s = simularSemItens(RESUMO, new Set(['02.01']));
  perto(assert, s.linha.realizadoAcm, (100 * 1 + 200 * 0.55) / 300, 'média dos que sobraram');
  assert.equal(s.linha.economico.orcamentoProjetado, null, 'econômico só existe no item pai');
});

test('Simulação — filho de pai retirado não conta duas vezes', () => {
  const s = simularSemItens(RESUMO, new Set(['02', '02.01']));
  assert.deepEqual(s.itens.map((l) => l.item), ['02']);
  perto(assert, s.linha.realizadoAcm, 1, 'só sobra o item 01');
});

test('Simulação — retirar tudo não gera linha', () => {
  const s = simularSemItens(RESUMO, new Set(['01', '02']));
  assert.equal(s.linha, null);
});

test('Simulação — coluna em que os itens não fecham com o total fica sem simulação', () => {
  // Planilha com o acumulado repetido na coluna do mês das atividades: 0,25 × 1 + 0,75 × 0,4 ≠ 0,02
  const resumo = { ...RESUMO, total: { ...RESUMO.total, realizadoMes: 0.02 } };
  const s = simularSemItens(resumo, new Set(['01']));
  assert.deepEqual(s.semConciliar, ['realizadoMes']);
  assert.equal(s.linha.realizadoMes, null);
  assert.equal(s.linha.acerto, null, '% acerto depende do realizado mês');
  perto(assert, s.linha.realizadoAcm, 0.4, 'as demais colunas continuam simuladas');
});

test('desvio da meta = realizado acumulado − planejado acumulado', () => {
  perto(assert, desvioDaMeta({ realizadoAcm: 0.6, planejadoAcm: 0.65 }), -0.05, 'desvio');
  assert.equal(desvioDaMeta({ realizadoAcm: null, planejadoAcm: 0.65 }), null);
});
