/**
 * Carga do modo demonstração (tests/fixtures/seguranca-exemplo.mjs), lida da planilha
 * "Controle de Acidentes-Dashboard.xlsx". A planilha fica fora do git: sem ela (ex.: build da Vercel) o teste é pulado.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { calcularIndicadores } from '../../public/js/domain/seguranca.js';
import { gerarCargaSeguranca, lerLinhasDaPlanilha, PLANILHA_PADRAO } from '../fixtures/seguranca-exemplo.mjs';

test('carga de exemplo: todas as linhas da planilha, com os totais do Dashboard do Excel', { skip: !existsSync(PLANILHA_PADRAO) && 'planilha de exemplo ausente' }, () => {
  const linhas = lerLinhasDaPlanilha();
  const { cadastros, acidentes } = gerarCargaSeguranca({ linhas });
  assert.deepEqual(gerarCargaSeguranca({ linhas }), gerarCargaSeguranca({ linhas }), 'carga não determinística');

  // Conferência documentada em docs/SEGURANCA_TRABALHO.md: 142 linhas, CPT 98 · SPT 39 · TRJ 5, fases 12/119/11.
  assert.equal(acidentes.length, 142);
  const ind = calcularIndicadores(acidentes);
  assert.deepEqual(Object.fromEntries(ind.porTipo.map((t) => [t.rotulo, t.valor])), { CPT: 98, SPT: 39, TRJ: 5, FT: 0 });
  assert.deepEqual(ind.porFase.map((f) => f.valor).sort((a, b) => a - b), [11, 12, 119]);
  assert.deepEqual(ind.porAno.map((a) => a.valor), [17, 50, 51, 24]);
  assert.equal(ind.mediaDias.toFixed(4), '6.1786', 'média de dias da Tab02 (linhas sem dias ficam fora)');

  const ids = new Set(cadastros.map((c) => c.id));
  assert.ok(acidentes.every((a) => ids.has(a.obraId)), 'acidente sem obra no cadastro');
  assert.ok(cadastros.every((c) => c.cliente && c.sistemaEstrutural), 'obra sem Incorporação ou Método construtivo');
  assert.equal(new Set(acidentes.map((a) => a.chaveDedup)).size, acidentes.length, 'chave de deduplicação repetida');
});
