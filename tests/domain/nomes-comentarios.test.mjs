/**
 * v29 — Nomes das colunas (Dev) e comentários por tela: validação pura usada pelo servidor e pelo front.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comentariosDaTela, documentoComentarios, validarComentario } from '../../public/js/domain/comentarios-telas.js';
import { COLUNAS_ECONOMICO } from '../../public/js/domain/resumo-economico.js';
import { COLUNAS_FISICO, nomeColuna, normalizarNomes, RENOMEAVEIS } from '../../public/js/domain/nomes-colunas.js';

test('nomes das colunas: toda coluna das duas tabelas é renomeável, com chave única', () => {
  const chaves = RENOMEAVEIS.map((r) => r.chave);
  assert.equal(new Set(chaves).size, chaves.length);
  assert.equal(RENOMEAVEIS.filter((r) => r.tabela === 'fisico' && r.tipo === 'coluna').length, COLUNAS_FISICO.length);
  assert.equal(RENOMEAVEIS.filter((r) => r.tabela === 'economico' && r.tipo === 'coluna').length, COLUNAS_ECONOMICO.length);
  assert.ok(chaves.includes('economico.grupo.Sem correção'));
});

test('nomes das colunas: só chaves conhecidas, espaços limpos, sem vazio nem igual ao original', () => {
  assert.deepEqual(normalizarNomes({
    'economico.coluna.avanco': '  Avanço   físico ', 'economico.coluna.iec': 'IEC', 'fisico.coluna.acerto': '   ', 'outra.chave': 'x', 'fisico.grupo.pesos': 7,
  }), { 'economico.coluna.avanco': 'Avanço físico' });
  assert.equal(normalizarNomes({ 'fisico.coluna.iec': 'x'.repeat(100) })['fisico.coluna.iec'].length, 60);
  assert.deepEqual(normalizarNomes(null), {});
  assert.deepEqual(normalizarNomes(['a']), {});
  assert.equal(nomeColuna({ 'fisico.coluna.iec': 'Índice' }, 'fisico.coluna.iec', 'IEC'), 'Índice');
  assert.equal(nomeColuna(undefined, 'fisico.coluna.iec', 'IEC'), 'IEC');
});

test('comentários: validação, documento por obra e mês e ordem mais recente primeiro', () => {
  assert.deepEqual(validarComentario({ obra: ' Alpha ', mes: '2026-03', tela: 'tela-abc_1', visao: 'x', texto: ' oi ' }),
    { obra: 'Alpha', mes: '2026-03', tela: 'tela-abc_1', visao: 'obra', texto: 'oi' });
  assert.throws(() => validarComentario({ obra: 'A', mes: '2026-13', tela: 't', texto: 'x' }), /mês/);
  assert.throws(() => validarComentario({ obra: 'A', mes: '2026-03', tela: '../x', texto: 'x' }), /tela/);
  assert.throws(() => validarComentario({ obra: 'A', mes: '2026-03', tela: 't', texto: ' ' }), /Escreva/);
  assert.throws(() => validarComentario({ obra: 'A', mes: '2026-03', tela: 't', texto: 'x'.repeat(2001) }), /2000/);
  assert.equal(documentoComentarios('residencial alpha/../x', '2026-03'), 'comentarios-telas/residencial_alpha_x/2026-03');
  const lista = [{ tela: 'a', criadoEm: '2026-01-01' }, { tela: 'b', criadoEm: '2026-02-01' }, { tela: 'a', criadoEm: '2026-03-01' }];
  assert.deepEqual(comentariosDaTela(lista, 'a').map((c) => c.criadoEm), ['2026-03-01', '2026-01-01']);
});
