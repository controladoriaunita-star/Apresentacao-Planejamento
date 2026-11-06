/**
 * Regressão das medidas (DAX → JS) com a planilha fictícia. Os valores esperados saem das regras de
 * geração em tests/fixtures/gerar-exemplo.mjs (curvas lineares).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseExemplo, fisicoExemplo, perto } from './apoio.mjs';
import { mesReferenciaPadrao, periodoPadrao, ultimoMesFechado } from '../../public/js/domain/periodo.js';
import { calcularResumoGeral, indiceIec } from '../../public/js/domain/resumo-geral.js';
import { calcularInicio, obraAtiva } from '../../public/js/domain/inicio.js';
import { calcularResumoFisico, compararItens } from '../../public/js/domain/resumo-fisico.js';
import { calcularResumoEconomico } from '../../public/js/domain/resumo-economico.js';
import { indiceFimDaSerie, semRepeticao, semRepeticaoNoFim } from '../../public/js/domain/series.js';
import { mediaPonderada } from '../../public/js/domain/agregar.js';

const ALPHA = 'residencial alpha';
const BETA = 'edificio beta';
const GAMA = 'torre gama';
const REF = '2026-03';

test('base junta as abas e lista as obras', () => {
  const base = baseExemplo();
  assert.deepEqual(base.obras.map((o) => o.chave), [BETA, ALPHA, GAMA]);
  assert.equal(base.obras.find((o) => o.chave === ALPHA).uau, '101');
});

test('mês de referência = último mês com realizado, sem passar de hoje', () => {
  const base = baseExemplo();
  assert.equal(ultimoMesFechado(base, ALPHA), REF);
  assert.equal(ultimoMesFechado(base, GAMA), '2025-10', 'Gama chega a 100% em out/25');
  assert.equal(mesReferenciaPadrao(base, [ALPHA, BETA], '2026-10'), REF);
  assert.equal(mesReferenciaPadrao(base, [ALPHA], '2026-01'), '2026-01');
  assert.deepEqual(periodoPadrao(base, [ALPHA], '2026-10'), { de: '2025-01', ate: '2026-12', referencia: REF });
});

test('Resumo Geral — painel CEF × Físico de uma obra', () => {
  const base = baseExemplo();
  const r = calcularResumoGeral(base, { obras: [ALPHA], de: '2025-01', ate: '2026-12', referencia: REF });
  const f = r.painelFisico.atual.fisico;
  perto(assert, f.avancoAcm, 0.6, 'realizado acumulado (15 × 4%)');
  perto(assert, f.avancoMes, 0.04, 'realizado do mês');
  perto(assert, f.previsto, 15 / 24, 'replanejado acumulado');
  perto(assert, f.desvio, 0.6 - 15 / 24, 'desvio físico = realizado − previsto');
  // Alpha não tem curva CEF → tudo zerado
  assert.equal(r.painelFisico.temCef, false);
  assert.deepEqual(r.painelFisico.atual.cef, { avancoMes: 0, avancoAcm: 0, cronograma: 0, previsto: 0, desvio: 0 });
  // Próximo mês: projetado = meta subsequente; previsto = replanejado de abr/26
  const p = r.painelFisico.proximo.fisico;
  perto(assert, p.projetadoMes, 1 / 24, 'meta do mês seguinte');
  perto(assert, p.projetadoAcm, 0.6 + 1 / 24, 'meta acumulada do mês seguinte');
  perto(assert, p.previsto, 16 / 24, 'replanejado de abr/26');
  perto(assert, r.andamento, 0.6, 'velocímetro');
});

test('Resumo Geral — CEF da obra com curva da Caixa', () => {
  const base = baseExemplo();
  const r = calcularResumoGeral(base, { obras: [BETA], de: '2025-01', ate: '2026-12', referencia: REF });
  const c = r.painelFisico.atual.cef;
  assert.equal(r.painelFisico.temCef, true);
  perto(assert, c.avancoAcm, 0.75, 'realizado CEF (15 × 5%)');
  perto(assert, c.previsto, 0.675, 'previsto CEF (15 × 4,5%)');
  perto(assert, c.desvio, 0.075, 'desvio CEF');
  perto(assert, r.painelFisico.proximo.cef.desvio, 0.8 - 0.72, 'desvio CEF do mês seguinte');
});

test('Resumo Geral — gráficos cortam o realizado no mês de referência', () => {
  const base = baseExemplo();
  const r = calcularResumoGeral(base, { obras: [ALPHA], de: '2025-01', ate: '2026-12', referencia: REF });
  const { meses, curvaAcumulada, realizadoPlanejadoMes, assertividade } = r.graficos;
  assert.equal(meses.length, 24);
  assert.equal(curvaAcumulada.realizado.filter((v) => v !== null).length, 15);
  assert.equal(realizadoPlanejadoMes.realizado[15], null, 'abr/26 em diante sem realizado');
  perto(assert, assertividade[0], 0.04 / (1 / 24), 'assertividade = realizado ÷ planejado do mês');
});

test('Resumo Geral — gráficos vão só até o último mês do replanejado', () => {
  assert.equal(indiceFimDaSerie([0.5, 0.9, 1, 1, 1, null]), 2, 'primeiro mês do valor final');
  assert.equal(indiceFimDaSerie([null, null]), -1);
  const base = baseExemplo();
  const beta = calcularResumoGeral(base, { obras: [BETA], de: '2025-01', ate: '2026-12', referencia: REF });
  assert.equal(beta.graficos.meses.at(-1), '2026-08', 'Beta: replanejado chega a 100% em ago/26');
  assert.equal(beta.graficos.curvaAcumulada.planejadoAtual.length, beta.graficos.meses.length);
  const gama = calcularResumoGeral(base, { obras: [GAMA], de: '2025-01', ate: '2026-12', referencia: REF });
  assert.equal(gama.graficos.meses.at(-1), REF, 'nunca corta antes do mês de referência');
});

test('Resumo Geral — análise econômica, custos por unidade, INCC e NH-NU', () => {
  const base = baseExemplo();
  const r = calcularResumoGeral(base, { obras: [ALPHA], de: '2025-01', ate: '2026-12', referencia: REF });
  const e = r.economico;
  assert.equal(e.orcado, 10_000_000);
  perto(assert, e.projetado, 9_800_000, 'custo projetado');
  perto(assert, e.desvio, 200_000, 'desvio R$ = orçado − projetado');
  perto(assert, e.iec, 0.98, 'IEC');
  perto(assert, e.percIndireto, 0.3, '% indireto = item 16 ÷ geral');
  perto(assert, e.custoPagoAPagar, 4_500_000, 'pago + NFs lançadas');
  perto(assert, e.saldosOcContratos, 500_000, 'saldos OC + contratos');
  assert.equal(e.aditivosAprovados, 30_000, 'aprovados = total − a aprovar');
  assert.equal(e.custosNaoIncidentes, -10_000);

  // custo s/ correção = orçado − resultado s/ correção = 10.000.000 + 100.000
  perto(assert, r.custosPor.uh, 10_100_000 / 200, 'custo por UH');
  perto(assert, r.custosPor.ae, 10_100_000 / 10_000, 'custo por área equivalente');
  perto(assert, r.incc.reajuste, 0.1, 'INCC 1100 ÷ 1000 − 1');
  perto(assert, r.nhnu, (100 * 200 * 0.04) / 100, 'NH-NU (medida do Power BI)');
});

test('Resumo Geral — várias obras: soma em R$ e média ponderada pelo orçamento', () => {
  const base = baseExemplo();
  const r = calcularResumoGeral(base, { obras: [ALPHA, BETA], de: '2025-01', ate: '2026-12', referencia: REF });
  assert.equal(r.economico.orcado, 40_000_000);
  perto(assert, r.painelFisico.atual.fisico.avancoAcm, (0.6 * 10 + 0.75 * 30) / 40, 'realizado ponderado');
  perto(assert, r.economico.iec, 0.98, 'IEC recalculado pelas somas');
});

test('IEC sem dado vira null, com uma obra devolve a coluna', () => {
  assert.equal(indiceIec([]), null);
  assert.equal(indiceIec([{ iec: 1.02, custoProjetado: 1, resultadoProjetado: 0 }]), 1.02);
  perto(assert, indiceIec([{ custoProjetado: 90, resultadoProjetado: 10 }, { custoProjetado: 110, resultadoProjetado: -10 }]), 1, 'Σ projetado ÷ Σ orçado');
});

test('Início — obras ativas, assertividade média e melhor obra', () => {
  const base = baseExemplo();
  assert.equal(obraAtiva(base, GAMA, REF), false, 'Gama concluída');
  const r = calcularInicio(base, REF);
  assert.deepEqual(r.ativas.map((o) => o.chave).sort(), [BETA, ALPHA]);
  perto(assert, r.assertividadeMedia, (0.96 + 1) / 2, 'média simples entre quem fechou o mês');
  assert.equal(r.melhor.nome, 'Edifício Beta');
  perto(assert, r.unidadesMes, 200 * 0.04, 'UH × realizado do mês (só Alpha tem cadastro)');
  assert.deepEqual(r.obrasSemCadastroUH, ['Edifício Beta']);
});

test('Início — situação do cadastro prevalece', () => {
  const base = baseExemplo('obra', { cadastro: [{ obra: 'Torre Gama', situacao: 'ativa' }, { obra: 'Edifício Beta', situacao: 'paralisada' }] });
  assert.deepEqual(calcularInicio(base, REF).ativas.map((o) => o.chave).sort(), [ALPHA, GAMA]);
});

test('Resumo Físico — árvore pai/filho e projeção do mês seguinte', () => {
  const base = baseExemplo();
  const r = calcularResumoFisico(base, fisicoExemplo('Residencial Alpha'), ALPHA, REF);
  assert.deepEqual(r.linhas.map((l) => `${l.nivel}:${l.item}`), ['1:01', '1:02', '2:02.01', '2:02.02']);
  const estrutura = r.linhas.find((l) => l.item === '02');
  assert.equal(estrutura.descricao, 'Estrutura');
  assert.equal(estrutura.orcamento, 6_000_000);
  perto(assert, estrutura.adiantamento, 0.6 - 15 / 24, 'adiantamento = realizado − cronograma');
  perto(assert, estrutura.proximo.planejadoAcm, 0.6 + 1 / 24, 'planejado acumulado seguinte');
  perto(assert, estrutura.proximo.previsto, 16 / 24, 'previsto = replanejado do mês seguinte');
  perto(assert, estrutura.proximo.adiantamento, 0.6 + 1 / 24 - 16 / 24, 'adiantamento projetado');
  perto(assert, estrutura.economico.orcamentoProjetado, 9_800_000 * 0.6, 'projeção econômica do item');
  assert.equal(r.linhas.find((l) => l.item === '02.01').comentario, 'Atraso na concretagem da laje');
  assert.equal(r.total.principaisMetas, 'Concluir estrutura');
});

test('Resumo Físico — visão cliente usa comentários do cliente', () => {
  const base = baseExemplo('cliente');
  const r = calcularResumoFisico(base, fisicoExemplo('Residencial Alpha', 'cliente'), ALPHA, REF);
  assert.equal(r.total.comentario, 'Comentário para o cliente');
  assert.equal(r.linhas.find((l) => l.item === '02.01').comentario, null);
});

test('Resumo Econômico — itens ordenados e comentários', () => {
  const base = baseExemplo();
  const r = calcularResumoEconomico(base, ALPHA, REF);
  assert.deepEqual(r.linhas.map((l) => l.item), ['01', '02', '16']);
  assert.equal(r.geral.iec, 0.98);
  assert.deepEqual(r.linhas[1].comentarios, [['Variações principais', 'Economia no contrato de estrutura']]);
});

test('ordem de EAP é numérica', () => {
  assert.deepEqual(['10', '02.10', '02', '02.02', '1'].sort(compararItens), ['1', '02', '02.02', '02.10', '10']);
});

test('sem repetição replica o Power BI', () => {
  assert.deepEqual(semRepeticao([0.5, 1, 1, 1, 1], 3), [0.5, 1, 1, 1, null]);
  assert.deepEqual(semRepeticao([null, 0, 0], 1), [null, 0, null]);
});

test('gráficos só cortam a repetição do fim da série (bug: planejado mensal constante sumia)', () => {
  assert.deepEqual(semRepeticaoNoFim([0.05, 0.05, 0.05, 0, 0, 0, null], 2), [0.05, 0.05, 0.05, 0, 0, null, null]);
  assert.deepEqual(semRepeticaoNoFim([0.5, 1, 1, 1, 1], 3), [0.5, 1, 1, 1, null]);
  const base = baseExemplo();
  const r = calcularResumoGeral(base, { obras: [BETA], de: '2025-01', ate: '2026-12', referencia: REF });
  assert.equal(r.graficos.realizadoPlanejadoMes.planejado.filter((v) => v === 0.05).length, 20, 'todos os 20 meses de 5%');
});

test('média ponderada ignora valores nulos', () => {
  assert.equal(mediaPonderada([{ valor: 1, peso: 3 }, { valor: null, peso: 100 }, { valor: 0, peso: 1 }]), 0.75);
  assert.equal(mediaPonderada([]), null);
});
