/** v34 — colunas que o Dev oculta na apresentação Cliente. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCULTAVEIS, colunaOculta, normalizarOcultas } from '../../public/js/domain/colunas-ocultas.js';

test('colunas ocultas: só chaves conhecidas, sem repetir, na ordem das tabelas', () => {
  assert.deepEqual(normalizarOcultas(['economico.iec', 'fisico.iec', 'fisico.iec', 'fisico.inexistente', 42]), ['fisico.iec', 'economico.iec']);
  assert.deepEqual(normalizarOcultas('fisico.iec'), [], 'não-lista = nenhuma');
});

test('colunas ocultas: as do grupo "Sem correção" já são fixas no Cliente e não entram na escolha', () => {
  assert.ok(!OCULTAVEIS.some((o) => o.chave === 'economico.iecSemCorrecao'));
  assert.deepEqual(normalizarOcultas(['economico.iecSemCorrecao']), []);
});

test('colunas ocultas: cada tabela mantém ao menos uma coluna visível', () => {
  const todasFisico = OCULTAVEIS.filter((o) => o.tabela === 'fisico').map((o) => o.chave);
  assert.deepEqual(normalizarOcultas([...todasFisico, 'economico.iec']), ['economico.iec']);
});

test('colunas ocultas: valem só na apresentação Cliente', () => {
  assert.equal(colunaOculta(['fisico.iec'], 'cliente', 'fisico.iec'), true);
  assert.equal(colunaOculta(['fisico.iec'], 'obra', 'fisico.iec'), false);
  assert.equal(colunaOculta(undefined, 'cliente', 'fisico.iec'), false);
});
