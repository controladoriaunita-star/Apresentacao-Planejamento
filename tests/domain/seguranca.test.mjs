/** Segurança do Trabalho — validação, deduplicação, importação e indicadores (public/js/domain/seguranca.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analisarImportacao, calcularIndicadores, chaveDeduplicacao, diasValidos, mesesDoGrafico, parteCorpoPadrao, primeiros, serieMensalPorTipo,
  siglaTipo, tabelaPorPeriodo, validarAcidente,
} from '../../public/js/domain/seguranca.js';

const HOJE = '2026-11-04';
const valido = {
  data: '2025-02-06', obraId: 'obra-1', faseObra: 'Estrutura', nomeAcidentado: 'Arlindo Vitor', funcao: 'Líder de Obras',
  empresa: 'Tr Materiais', tipo: 'CPT', parteCorpo: 'Punho', diasAfastamento: 7, resumo: 'Prensou o punho na furadeira.',
};
const cadastros = [
  { id: 'obra-1', chave: 'mc dom bosco', obra: 'MC Dom Bosco', cliente: 'Metrocasa', sistemaEstrutural: 'Alvenaria Estrutural' },
  { id: 'obra-2', chave: 'sem cliente', obra: 'Sem Cliente', cliente: null, sistemaEstrutural: 'Parede de Concreto' },
];
const linha = (campos = {}) => ({
  'Data do Acidente': '2023-01-24', Mês: 'Jan', Ano: '2023', 'Nome da Obra': 'MC Dom Bosco', Incorporação: 'Metrocasa', 'Método Construtivo': 'Alvenaria Estrutural',
  'Fase da Obra': 'Fundação', 'Nome do Acidentado': 'Josimar Ferreira da Silva', Função: 'Servente', 'Nome da Empresa': 'Persona', Tipo: 'CPT',
  'Parte do Corpo Atingida': 'Mandíbula', 'Dias Afastamento': 5, 'Resumo do Acidente': 'Barra tensionada atingiu o queixo.', ...campos,
});

test('acidente válido é normalizado e ganha a chave de deduplicação', () => {
  const { acidente, erros } = validarAcidente(valido, { hoje: HOJE });
  assert.deepEqual(erros, []);
  assert.equal(acidente.tipo, 'CPT');
  assert.equal(acidente.chaveDedup, '2025-02-06|obra-1|arlindo vitor|CPT|punho|lider de obras|tr materiais');
});

test('todos os campos são obrigatórios', () => {
  const { acidente, erros } = validarAcidente({}, { hoje: HOJE });
  assert.equal(acidente, null);
  assert.equal(erros.length, 10, erros.join('\n'));
});

test('listas fechadas e dias inteiros não negativos', () => {
  assert.equal(siglaTipo('cpt'), 'CPT');
  assert.equal(siglaTipo('TRJ – Acidente de trajeto'), 'TRJ');
  assert.equal(siglaTipo('XYZ'), null);
  assert.equal(parteCorpoPadrao('mão'), 'Mão');
  assert.equal(parteCorpoPadrao('Abdomen'), 'Abdômen');
  assert.equal(parteCorpoPadrao('Cotovelo'), null);
  assert.equal(diasValidos('0'), 0);
  assert.equal(diasValidos(3), 3);
  for (const v of [-1, 2.5, '', null, 'abc']) assert.equal(diasValidos(v), null, String(v));
  assert.match(validarAcidente({ ...valido, data: '2027-01-01' }, { hoje: HOJE }).erros[0], /futura/);
  assert.match(validarAcidente({ ...valido, faseObra: 'Fachada' }, { hoje: HOJE }).erros[0], /fora da lista/);
});

test('deduplicação não usa só nome ou data: acidentes parecidos continuam distintos', () => {
  const a = validarAcidente(valido, { hoje: HOJE }).acidente;
  const mesmoDiaOutraParte = validarAcidente({ ...valido, parteCorpo: 'Mão' }, { hoje: HOJE }).acidente;
  const diasCorrigidos = validarAcidente({ ...valido, diasAfastamento: 15, resumo: 'Texto revisado' }, { hoje: HOJE }).acidente;
  assert.notEqual(a.chaveDedup, mesmoDiaOutraParte.chaveDedup);
  assert.equal(a.chaveDedup, diasCorrigidos.chaveDedup, 'prorrogar o afastamento não cria outro acidente');
  assert.equal(chaveDeduplicacao({ ...a, nomeAcidentado: '  ARLINDO   VÍTOR ' }), a.chaveDedup.replace('arlindo vitor', 'arlindo vitor'));
});

test('importação: novo, existente, repetido na planilha, erro e linha vazia ignorada', () => {
  const primeira = linha();
  const existente = linha({ 'Nome do Acidentado': 'Raimundo Nonato Lima', Tipo: 'TRJ', 'Parte do Corpo Atingida': 'joelho', 'Dias Afastamento': 15 });
  const chaveExistente = analisarImportacao([existente], cadastros, new Map(), { hoje: HOJE }).linhas[0].acidente.chaveDedup;
  const r = analisarImportacao([
    primeira,
    existente,
    { ...primeira },
    linha({ 'Nome da Obra': 'Obra Desconhecida' }),
    linha({ 'Nome da Obra': 'Sem Cliente' }),
    linha({ Tipo: 'ABC', 'Dias Afastamento': -2 }),
    { 'Data do Acidente': null, 'Nome da Obra_1': 'MC Centro', Incorporação_1: 'Metrocasa' }, // listas de validação ao lado
  ], cadastros, new Map([[chaveExistente, { diasAfastamento: 10 }]]), { hoje: HOJE });
  assert.deepEqual(r.totais, { lidas: 6, novos: 1, existentes: 1, repetidos: 1, erros: 3 });
  assert.match(r.linhas[1].avisos[0], /10 dia/);
  assert.match(r.linhas[3].erros[0], /não encontrada/);
  assert.match(r.linhas[4].erros[0], /Cliente/);
  assert.equal(r.linhas[5].erros.length, 2);
  assert.deepEqual(r.obrasNaoEncontradas, [{ chave: 'obra desconhecida', nome: 'Obra Desconhecida' }]);
});

test('importação: de-para de obra e aviso quando incorporação diverge do cadastro', () => {
  const r = analisarImportacao([linha({ 'Nome da Obra': 'Dom Bosco', Incorporação: 'Outra' })], cadastros, new Map(), { hoje: HOJE, mapaObras: { 'dom bosco': 'obra-1' } });
  assert.equal(r.linhas[0].situacao, 'novo');
  assert.equal(r.linhas[0].acidente.obraId, 'obra-1');
  assert.match(r.linhas[0].avisos[0], /vale a do cadastro: "Metrocasa"/);
});

test('indicadores reproduzem as tabelas dinâmicas do Dashboard-01/02', () => {
  const base = { faseObra: 'Estrutura', funcao: 'Pedreiro', empresa: 'Persona', parteCorpo: 'Dedo', obra: 'A' };
  const acidentes = [
    { ...base, data: '2024-01-10', tipo: 'CPT', diasAfastamento: 5 },
    { ...base, data: '2025-01-20', tipo: 'SPT', diasAfastamento: 0, faseObra: 'Fundação', empresa: 'Persona ' },
    { ...base, data: '2025-03-05', tipo: 'CPT', diasAfastamento: 10, parteCorpo: 'Mão', obra: 'B' },
  ];
  const i = calcularIndicadores(acidentes);
  assert.equal(i.total, 3);
  assert.equal(i.mediaDias, 5);
  assert.deepEqual(i.porMes.slice(0, 3).map((m) => m.valor), [2, 0, 1]);
  assert.deepEqual(i.porAno, [{ rotulo: '2024', valor: 1 }, { rotulo: '2025', valor: 2 }]);
  assert.deepEqual(i.porTipo, [{ rotulo: 'CPT', valor: 2 }, { rotulo: 'SPT', valor: 1 }, { rotulo: 'TRJ', valor: 0 }, { rotulo: 'FT', valor: 0 }]);
  assert.deepEqual(i.porEmpresa, [{ rotulo: 'Persona', valor: 3 }], 'grafias com espaço sobrando contam juntas');
  assert.deepEqual(i.porObra.map((o) => o.rotulo), ['A', 'B']);
  assert.equal(calcularIndicadores([]).mediaDias, null);
});

test('10 primeiros incluem os empatados com o 10º (como o filtro do Excel)', () => {
  const itens = Array.from({ length: 12 }, (_, k) => ({ rotulo: `f${k}`, valor: k < 9 ? 20 - k : 3 }));
  assert.equal(primeiros(itens).length, 12);
  assert.equal(primeiros(itens.slice(0, 5)).length, 5);
});

test('modelo do indicador: série mensal por tipo e tabela por período com o mês de referência', () => {
  const acidentes = [
    { data: '2025-02-06', tipo: 'CPT', diasAfastamento: 7 },
    { data: '2025-02-25', tipo: 'CPT', diasAfastamento: 5 },
    { data: '2025-08-28', tipo: 'SPT', diasAfastamento: 0 },
  ];
  const s = serieMensalPorTipo(acidentes, ['2025-01', '2025-02', '2025-08']);
  assert.deepEqual(s.CPT, [0, 2, 0]);
  assert.deepEqual(s.SPT, [0, 0, 1]);
  const t = tabelaPorPeriodo(acidentes, { referencia: '2026-09' });
  assert.deepEqual(t.map((p) => p.mes), ['2025-02', '2025-08', '2026-09']);
  assert.equal(t[0].porTipo.CPT, 2);
  assert.equal(t[0].diasPerdidos, 12);
  assert.equal(t[2].acidentes.length, 0);
});

test('meses do gráfico: 1 mês antes do primeiro, 1 depois do último, mínimo de 12', () => {
  const longo = mesesDoGrafico([{ data: '2024-09-02' }, { data: '2026-04-09' }, { data: '2025-02-06' }]);
  assert.equal(longo[0], '2024-08');
  assert.equal(longo.at(-1), '2026-05');
  assert.equal(longo.length, 22, 'meses sem acidente entre o primeiro e o último ficam');
  const curto = mesesDoGrafico([{ data: '2026-03-10' }, { data: '2026-05-01' }]);
  assert.deepEqual([curto.length, curto[0], curto.at(-1)], [12, '2025-07', '2026-06'], 'completa para trás até 12 meses');
  const vazio = mesesDoGrafico([], { referencia: '2026-09' });
  assert.deepEqual([vazio.length, vazio[0], vazio.at(-1)], [12, '2025-10', '2026-09']);
});
