/**
 * Layout do Resumo Geral (grade 24 × 24): padrão sem sobreposição, ajuste dos limites e recusa de quadros
 * sobrepostos ao salvar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ajustarRetangulo, GRADE, LAYOUT_IMPRESSAO, LAYOUT_PADRAO, MINIMO, normalizarLayout, QUADROS, QUADROS_OCULTOS, sobreposicoes,
} from '../../public/js/domain/layout-resumo.js';

const area = (r) => r.w * r.h;

test('Layout — o padrão tem todos os quadros, sem sobreposição, e cobre a grade inteira', () => {
  assert.deepEqual(Object.keys(LAYOUT_PADRAO).sort(), QUADROS.map((q) => q.id).sort());
  assert.deepEqual(sobreposicoes(LAYOUT_PADRAO), []);
  const total = Object.values(LAYOUT_PADRAO).reduce((s, r) => s + area(r), 0);
  assert.equal(total, GRADE.colunas * GRADE.linhas, 'nenhum espaço vazio na tela');
  assert.deepEqual(normalizarLayout(LAYOUT_PADRAO), LAYOUT_PADRAO);
});

test('Layout — quadro faltando volta ao padrão; valores fora da grade são ajustados', () => {
  const l = normalizarLayout({ ...LAYOUT_PADRAO, nhnu: undefined, extra: { x: 1, y: 1, w: 3, h: 3 } });
  assert.deepEqual(l.nhnu, LAYOUT_PADRAO.nhnu);
  assert.equal(l.extra, undefined, 'chave desconhecida descartada');
  const r = ajustarRetangulo({ x: 30, y: 0, w: 1, h: 99 }, LAYOUT_PADRAO.andamento);
  assert.equal(r.w, MINIMO.w, 'largura mínima');
  assert.equal(r.h, GRADE.linhas, 'altura limitada à grade');
  assert.equal(r.x + r.w - 1, GRADE.colunas, 'não sai pela direita');
  assert.equal(r.y, 1, 'não sai por cima');
  assert.deepEqual(ajustarRetangulo({ x: 2.5, y: 'a' }, LAYOUT_PADRAO.cef), LAYOUT_PADRAO.cef, 'não inteiro = padrão');
});

test('Layout — quadros sobrepostos: estrito recusa (ao salvar); senão volta ao padrão (ao exibir)', () => {
  const sobreposto = { ...LAYOUT_PADRAO, andamento: { ...LAYOUT_PADRAO.incc } };
  assert.throws(() => normalizarLayout(sobreposto, { estrito: true }), /INCC e Andamento geral/);
  assert.deepEqual(normalizarLayout(sobreposto), LAYOUT_PADRAO);
});

test('Layout (v28) — quadro oculto não conta na sobreposição: os vizinhos ocupam o espaço dele', () => {
  assert.deepEqual([...QUADROS_OCULTOS], ['nhnu']);
  const incc = { ...LAYOUT_PADRAO.incc, w: LAYOUT_PADRAO.incc.w + LAYOUT_PADRAO.nhnu.w }; // INCC cresce sobre o NH-NU
  const layout = { ...LAYOUT_PADRAO, incc };
  assert.deepEqual(sobreposicoes(layout), []);
  assert.deepEqual(normalizarLayout(layout, { estrito: true }), layout, 'o retângulo do NH-NU continua guardado');
});

test('Layout (v28) — disposição do PDF: quadros visíveis sem sobreposição cobrindo a grade inteira', () => {
  assert.deepEqual(Object.keys(LAYOUT_IMPRESSAO).sort(), QUADROS.map((q) => q.id).sort());
  assert.deepEqual(sobreposicoes(LAYOUT_IMPRESSAO), []);
  assert.deepEqual(normalizarLayout(LAYOUT_IMPRESSAO, { estrito: true }), LAYOUT_IMPRESSAO, 'dentro dos limites');
  const visiveis = QUADROS.filter((q) => !QUADROS_OCULTOS.includes(q.id));
  const area = visiveis.reduce((soma, q) => soma + LAYOUT_IMPRESSAO[q.id].w * LAYOUT_IMPRESSAO[q.id].h, 0);
  assert.equal(area, GRADE.colunas * GRADE.linhas, 'sem buracos na página');
});
