/**
 * Validador do econômico: competência real quando a planilha repete o fechamento anterior.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarEconomico } from '../../public/js/domain/validador-economico.js';

/** Base mínima: BD_Econômico da obra "x" com o custo projetado do item Geral por mês. */
const baseCom = (custos) => ({
  economico: new Map([['x', new Map(Object.entries(custos).map(([mes, custo]) => [mes, new Map([['Geral', { item: 'Geral', mes, custoProjetado: custo, iec: 0.98 }]])]))]]),
});

test('Validador econômico — mês com valores próprios e sem posterior é o último', () => {
  const v = validarEconomico(baseCom({ '2026-04': 100, '2026-05': 110 }), 'x', '2026-05');
  assert.deepEqual(v, { referencia: '2026-05', competenciaReal: '2026-05', repetido: false, ultimo: true, maisRecente: null });
});

test('Validador econômico — mês repetido aponta a competência real', () => {
  const base = baseCom({ '2026-04': 100, '2026-05': 110, '2026-06': 110, '2026-07': 110 });
  const v = validarEconomico(base, 'x', '2026-07');
  assert.equal(v.repetido, true);
  assert.equal(v.competenciaReal, '2026-05', 'jun e jul só copiaram maio');
  assert.equal(v.ultimo, true, 'maio continua sendo o último econômico');
});

test('Validador econômico — mês antigo avisa que há um mais recente', () => {
  const base = baseCom({ '2026-04': 100, '2026-05': 100, '2026-06': 120 });
  const v = validarEconomico(base, 'x', '2026-05');
  assert.equal(v.competenciaReal, '2026-04');
  assert.equal(v.ultimo, false);
  assert.equal(v.maisRecente, '2026-06');
});

test('Validador econômico — sem econômico no mês devolve null', () => {
  assert.equal(validarEconomico(baseCom({ '2026-04': 100 }), 'x', '2026-09'), null);
  assert.equal(validarEconomico(baseCom({}), 'y', '2026-09'), null);
});
