/**
 * v28 — Ordem das abas do menu superior: limpeza da lista salva e ordenação com abas novas no fim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarOrdemAbas, ordenarAbas } from '../../public/js/domain/ordem-abas.js';

const ids = (lista) => lista.map((a) => a.id);
const ABAS = ['inicio', 'resumo-geral', 'resumo-fisico', 'resumo-economico', 'tela-1'].map((id) => ({ id }));

test('normalizarOrdemAbas: só textos, sem repetição; entrada inválida vira lista vazia', () => {
  assert.deepEqual(normalizarOrdemAbas(['a', ' b ', 'a', 3, '', null, 'x'.repeat(200)]), ['a', 'b']);
  assert.deepEqual(normalizarOrdemAbas(null), []);
  assert.deepEqual(normalizarOrdemAbas('inicio'), []);
});

test('ordenarAbas: sem ordem salva mantém a ordem natural', () => {
  assert.deepEqual(ids(ordenarAbas(ABAS, null)), ids(ABAS));
  assert.deepEqual(ids(ordenarAbas(ABAS, [])), ids(ABAS));
});

test('ordenarAbas: segue a ordem salva; abas fora dela vão para o fim na ordem natural', () => {
  assert.deepEqual(ids(ordenarAbas(ABAS, ['resumo-economico', 'inicio'])), ['resumo-economico', 'inicio', 'resumo-geral', 'resumo-fisico', 'tela-1']);
  assert.deepEqual(ids(ordenarAbas(ABAS, ['tela-1', 'resumo-fisico', 'resumo-geral', 'inicio', 'resumo-economico'])), ['tela-1', 'resumo-fisico', 'resumo-geral', 'inicio', 'resumo-economico']);
  // ids que não existem mais (tela apagada) são ignorados
  assert.deepEqual(ids(ordenarAbas(ABAS, ['tela-99', 'resumo-fisico'])), ['resumo-fisico', 'inicio', 'resumo-geral', 'resumo-economico', 'tela-1']);
});
