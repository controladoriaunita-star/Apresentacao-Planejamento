import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chaveObra, dataIso, intervaloMeses, linhasParaObjetos, mesDe, numero, somarMeses, texto,
} from '../../public/js/domain/normalizar.js';
import { CAMPOS_INFOS_GERAIS } from '../../public/js/domain/colunas.js';

test('serial do Excel vira data e mês', () => {
  assert.equal(dataIso(46023), '2026-01-01');
  assert.equal(mesDe(46023), '2026-01');
  // fim de mês continua no próprio mês (a planilha usa 31/05 seguido de 01/06)
  assert.equal(mesDe('2025-05-31'), '2025-05');
  assert.equal(mesDe('15/03/2026'), '2026-03');
  assert.equal(mesDe(''), null);
});

test('números aceitam vazio, traço e formato pt-BR', () => {
  assert.equal(numero(''), null);
  assert.equal(numero('-'), null);
  assert.equal(numero('10119,56'), 10119.56);
  assert.equal(numero('R$ 1.234,50'), 1234.5);
  assert.equal(numero(0.25), 0.25);
  assert.equal(numero(Infinity), null);
});

test('texto "0" é comentário vazio', () => {
  assert.equal(texto('0'), null);
  assert.equal(texto('  Obra ok '), 'Obra ok');
});

test('chave de obra ignora acento, caixa e espaços', () => {
  assert.equal(chaveObra('MetroCasa Estação  Vila Prudente'), chaveObra('Metrocasa Estacao Vila Prudente'));
});

test('meses: soma e intervalo atravessam o ano', () => {
  assert.equal(somarMeses('2026-12', 1), '2027-01');
  assert.equal(somarMeses('2026-01', -1), '2025-12');
  assert.deepEqual(intervaloMeses('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('cabeçalhos com espaço duplo e variante de cliente', () => {
  const matriz = {
    colunas: ['Nome da Obra', 'Mês do Fechamento', 'Replanejado Atual  Acumulado - Obra', 'Replanejado Atual Acumulado - Cliente', 'Comentário Obra', 'Comentário Cliente'],
    linhas: [['Obra X', 46023, 0.5, 0.45, 'interno', 'externo']],
  };
  const [obra] = linhasParaObjetos(matriz, CAMPOS_INFOS_GERAIS, 'obra');
  const [cliente] = linhasParaObjetos(matriz, CAMPOS_INFOS_GERAIS, 'cliente');
  assert.equal(obra.replanAcm, 0.5);
  assert.equal(cliente.replanAcm, 0.45);
  assert.equal(obra.comentario, 'interno');
  assert.equal(cliente.comentario, 'externo');
  assert.equal(obra.realizadoAcm, null, 'coluna ausente vira null');
});
