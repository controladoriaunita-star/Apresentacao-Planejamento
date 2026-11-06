import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  apareceNa, destinoDaMidia, destinoDaTela, midiasDaVisao, normalizarMidia, normalizarTela, telasDaObra,
} from '../../public/js/domain/conteudo.js';

const MIDIA = { tipo: 'foto', obra: 'Residencial Alpha', mes: '2026-03', arquivoId: 'a1' };

test('destino: ambas aparece nas duas apresentações; obra/cliente só na sua', () => {
  assert.equal(apareceNa('ambas', 'obra'), true);
  assert.equal(apareceNa('ambas', 'cliente'), true);
  assert.equal(apareceNa('obra', 'obra'), true);
  assert.equal(apareceNa('obra', 'cliente'), false);
  assert.equal(apareceNa('cliente', 'cliente'), true);
  assert.equal(apareceNa('cliente', 'obra'), false);
});

test('registros antigos (sem destino) mantêm onde apareciam', () => {
  assert.equal(destinoDaTela({ titulo: 'X' }), 'cliente', 'telas eram só do Cliente');
  assert.equal(destinoDaMidia({ visivelCliente: true }), 'ambas');
  assert.equal(destinoDaMidia({ visivelCliente: false }), 'obra');
  assert.equal(destinoDaMidia({}), 'ambas');
  assert.equal(destinoDaTela({ destino: 'invalido' }), 'cliente');
});

test('normalizarMidia grava o destino e deriva visivelCliente', () => {
  assert.deepEqual(['ambas', 'obra', 'cliente'].map((destino) => {
    const m = normalizarMidia({ ...MIDIA, destino });
    return [m.destino, m.visivelCliente];
  }), [['ambas', true], ['obra', false], ['cliente', true]]);
  assert.equal(normalizarMidia({ ...MIDIA, visivelCliente: false }).destino, 'obra', 'contrato antigo continua aceito');
  assert.equal(normalizarMidia(MIDIA).destino, 'ambas');
});

test('normalizarTela grava o destino (padrão Cliente)', () => {
  assert.equal(normalizarTela({ titulo: 'X' }).destino, 'cliente');
  assert.equal(normalizarTela({ titulo: 'X', destino: 'obra' }).destino, 'obra');
  assert.equal(normalizarTela({ titulo: 'X', destino: 'ambas' }).destino, 'ambas');
});

test('telasDaObra filtra pela apresentação, além de ativa e obra', () => {
  const tela = (titulo, destino, extra = {}) => ({ titulo, destino, ativa: true, obras: [], ordem: 0, ...extra });
  const telas = [
    tela('Só obra', 'obra'), tela('Só cliente', 'cliente'), tela('Ambas', 'ambas'),
    { titulo: 'Antiga', ativa: true, obras: [], ordem: 0 },
    tela('Oculta', 'ambas', { ativa: false }), tela('Outra obra', 'ambas', { obras: ['beta'] }),
  ];
  assert.deepEqual(telasDaObra(telas, ['alpha'], 'obra').map((t) => t.titulo), ['Ambas', 'Só obra']);
  assert.deepEqual(telasDaObra(telas, ['alpha'], 'cliente').map((t) => t.titulo), ['Ambas', 'Antiga', 'Só cliente']);
});

test('midiasDaVisao separa as imagens de cada apresentação', () => {
  const lista = [{ id: 1, destino: 'obra' }, { id: 2, destino: 'cliente' }, { id: 3, destino: 'ambas' }, { id: 4, visivelCliente: false }, { id: 5, visivelCliente: true }];
  assert.deepEqual(midiasDaVisao(lista, 'obra').map((m) => m.id), [1, 3, 4, 5]);
  assert.deepEqual(midiasDaVisao(lista, 'cliente').map((m) => m.id), [2, 3, 5]);
});
