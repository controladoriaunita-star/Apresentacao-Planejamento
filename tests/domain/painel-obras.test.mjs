/**
 * Painel de Obras (capa) — réplica das fórmulas da aba "Painel" da planilha Painel de Obras.xlsm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseExemplo, perto } from './apoio.mjs';
import { economicoDoMes, infoDoMes, orcamentoGeral } from '../../public/js/domain/base.js';
import { calcularPainelObras, mesesCompletos, statusDesvio } from '../../public/js/domain/painel-obras.js';
import { associarObrasConhecidas, cadastrosDePlanilha } from '../../public/js/domain/cadastro-obra.js';

const ALPHA = 'residencial alpha';
const REF = '2026-03';

test('DATEDIF "m": meses completos; fim antes do início = vazio (#NUM!)', () => {
  assert.equal(mesesCompletos('2023-08-01', '2026-07-01'), 35);
  assert.equal(mesesCompletos('2023-08-01', '2026-05-31'), 33);
  assert.equal(mesesCompletos('2024-09-15', '2026-07-01'), 21, 'dia menor que o do início não completa o mês');
  assert.equal(mesesCompletos('2026-07-01', '2025-11-01'), null);
  assert.equal(mesesCompletos(null, '2026-07-01'), null);
});

test('status: desvio negativo atrasada, positivo adiantada, zero OK', () => {
  assert.equal(statusDesvio(-0.25), 'Atrasada');
  assert.equal(statusDesvio(0.05), 'Adiantada');
  assert.equal(statusDesvio(0), 'OK');
  assert.equal(statusDesvio(null), null);
});

test('painel: uma linha por obra do cadastro com físico, econômico, INCC e áreas', () => {
  const base = baseExemplo();
  const baseCliente = baseExemplo('cliente');
  const p = calcularPainelObras(base, baseCliente, REF);
  assert.deepEqual(p.linhas.map((l) => l.chave), [ALPHA], 'só obras cadastradas');
  const l = p.linhas[0];
  const info = infoDoMes(base, ALPHA, REF);
  const infoCliente = infoDoMes(baseCliente, ALPHA, REF);
  const eco = economicoDoMes(base, ALPHA, REF);

  assert.equal(l.geral.orcamentoRaso, orcamentoGeral(base, ALPHA), 'orçamento raso = BD_Orc Geral');
  assert.equal(l.realizado.avancoAcm, info.realizadoAcm);
  assert.equal(l.meta.acumulada, info.metaAcmSubsequente);
  perto(assert, l.fisicoCliente.realOriginal, info.realizadoAcm - infoCliente.previstoOriginalAcm, 'AM: realizado − previsto original Cliente');
  perto(assert, l.fisicoCliente.metaAtual, info.metaAcmSubsequente - infoCliente.replanAcm, 'AP: meta − replanejado atual Cliente');
  perto(assert, l.fisicoObra.realAtual, info.realizadoAcm - info.replanAcm, 'AT: realizado − replanejado atual Obra');

  perto(assert, l.economico.correcaoIncc, (1100 - 1000) / 1000, 'BG14: (INCC ref − INCC base) ÷ INCC base');
  perto(assert, l.economico.custoCorrigido, l.geral.orcamentoRaso - eco.resultadoProjetado, 'BB13: orçamento raso − resultado projetado');
  perto(assert, l.areas.custoEquivalente, (l.economico.custoCorrigido / 10_000) * 1.1, 'BM14: custo ÷ AE × (1 + correção)');
  perto(assert, l.areas.privativaMedia, 8_000 / 200, 'BK13: área privativa ÷ UH');
  assert.ok(!('emitida' in l.taxa), 'colunas sem fonte ficam fora do painel');
});

test('importação aceita os cabeçalhos do BD_Fixo e não apaga campos ausentes na planilha', () => {
  const [c] = cadastrosDePlanilha([{
    'Nome da Obra': 'Flow Vila Matilde', Cliente: 'REV 3', GGO: 'Eduardo Macedo', 'Engenheiro 1': 'Renato Rodrigues',
    Segmento: 'Econômico', 'Taxa Adm Inicial (R$)': 2925401.58615, 'Taxa (%)': 0.1, Banda: 0.03,
    'Orçamento com taxa, impostos e adicionais': 32494016.97, 'Fim Projetado de obra real': '2027-03-31', 'Área Equivalente (m²)': 11719.9,
  }]);
  assert.equal(c.obra, 'Flow Vila Matilde');
  assert.equal(c.gestao, 'Eduardo Macedo');
  assert.equal(c.engenharia, 'Renato Rodrigues');
  assert.equal(c.padrao, 'Econômico');
  assert.equal(c.taxaAdmInicial, 2925401.58615);
  assert.equal(c.taxaPercentual, 0.1);
  assert.equal(c.temBanda, 0.03);
  assert.equal(c.orcamentoComTaxa, 32494016.97);
  assert.equal(c.fimProjetadoReal, '2027-03-31');
  assert.equal(c.areaEquivalente, 11719.9);
  assert.equal(c.chave, 'flow vila matilde');
  assert.ok(!('bairro' in c), 'campo fora da planilha não vai como null');
});

test('importação: obra sem o cliente no nome ("Sacomã") vai para a obra das planilhas ("Habita Sacomã")', () => {
  const registros = cadastrosDePlanilha([
    { 'Nome da Obra': 'Sacomã', Cliente: 'Habita', 'Taxa (%)': 0.1 },
    { 'Nome da Obra': 'Estação Vila Prudente', Cliente: 'Metrocasa' },
    { 'Nome da Obra': 'Ipanema 212', Cliente: 'Pazza' },
    { 'Nome da Obra': 'Carvalho da Matta', Cliente: 'Unità' },
  ]);
  const planilhas = new Map([['habita sacoma', 'Habita Sacomã'], ['metrocasa estacao vila prudente', 'MetroCasa Estação Vila Prudente'], ['ipanema 212', 'Ipanema 212']]);
  const cadastro = new Map([['sacoma', 'Sacomã'], ['carvalho da matta', 'Carvalho da Matta']]);
  const r = associarObrasConhecidas(registros, [planilhas, cadastro]);
  assert.deepEqual(r.map((x) => [x.chave, x.obra]), [
    ['habita sacoma', 'Habita Sacomã'],
    ['metrocasa estacao vila prudente', 'MetroCasa Estação Vila Prudente'],
    ['ipanema 212', 'Ipanema 212'],
    ['carvalho da matta', 'Carvalho da Matta'],
  ]);
  assert.equal(r[0].taxaPercentual, 0.1);
});
