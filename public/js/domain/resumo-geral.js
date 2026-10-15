/**
 * Aba "Resumo Geral" — tradução das medidas DAX da página homônima do Power BI.
 * Cada bloco cita a medida original; divergências intencionais estão em docs/CALCULOS.md.
 */
import { economicoDoMes, infoDoMes, inccDoMes, orcamentoGeral } from './base.js';
import { dividir, mediaPonderada, somar, subtrair } from './agregar.js';
import { ITEM_INDIRETO } from './colunas.js';
import { intervaloMeses } from './normalizar.js';
import { mesSeguinte } from './periodo.js';
import { cortarApos, LIMITES_SEM_REPETICAO, semRepeticaoNoFim, serieInfos } from './series.js';

/**
 * @param {ReturnType<import('./base.js').criarBase>} base
 * @param {{obras: string[], de: string, ate: string, referencia: string}} filtro
 */
export function calcularResumoGeral(base, filtro) {
  const { obras, referencia } = filtro;
  const meses = intervaloMeses(filtro.de, filtro.ate);
  return {
    referencia,
    mesSeguinte: mesSeguinte(referencia),
    graficos: graficos(base, obras, meses, referencia),
    painelFisico: painelCefFisico(base, obras, referencia),
    economico: analiseEconomica(base, obras, referencia),
    custosPor: custosPorUnidade(base, obras, referencia),
    incc: indiceIncc(base, obras, referencia),
    nhnu: nhnu(base, obras, referencia),
    andamento: valorInfos(base, obras, referencia, 'realizadoAcm'),
  };
}

/** Curva acumulada, Realizado × Planejado (mês) e Assertividade, mês a mês. */
function graficos(base, obras, meses, referencia) {
  const serie = (campo) => serieInfos(base, obras, meses, campo);
  const realizado = (campo) => cortarApos(serie(campo), meses, referencia);
  return {
    meses,
    curvaAcumulada: {
      previstoOriginal: semRepeticaoNoFim(serie('previstoOriginalAcm'), LIMITES_SEM_REPETICAO.previstoOriginalAcm),
      realizado: realizado('realizadoAcm'),
      planejadoAtual: semRepeticaoNoFim(serie('replanAcm'), LIMITES_SEM_REPETICAO.replanAcm),
    },
    realizadoPlanejadoMes: {
      realizado: realizado('realizadoMes'),
      planejado: semRepeticaoNoFim(serie('replanMes'), LIMITES_SEM_REPETICAO.replanMes),
    },
    assertividade: realizado('assertividade'),
  };
}

/** Média ponderada (pelo orçamento) de um campo de BD_Infos Gerais no mês. */
function valorInfos(base, obras, mes, campo) {
  return mediaPonderada(obras.map((chave) => ({
    valor: infoDoMes(base, chave, mes)?.[campo] ?? null,
    peso: orcamentoGeral(base, chave),
  })));
}

/**
 * Quadro CEF × Físico (mês de referência e mês seguinte).
 * Obra sem curva CEF: os valores CEF vêm zerados, como pedido.
 */
export function painelCefFisico(base, obras, referencia) {
  const seguinte = mesSeguinte(referencia);
  const v = (mes, campo) => valorInfos(base, obras, mes, campo);
  const temCef = obras.some((chave) => [...(base.infos.get(chave)?.values() ?? [])]
    .some((l) => (l.cefPrevistoAcm ?? 0) > 0 || (l.cefCronogramaAcm ?? 0) > 0));
  const cef = (valor) => (temCef ? valor ?? 0 : 0);

  const atualCef = {
    avancoMes: cef(v(referencia, 'cefRealizadoMes')),
    avancoAcm: cef(v(referencia, 'cefRealizadoAcm')),
    cronograma: cef(v(referencia, 'cefCronogramaAcm')),
    previsto: cef(v(referencia, 'cefPrevistoAcm')),
  };
  atualCef.desvio = atualCef.avancoAcm - atualCef.previsto; // DAX [Desvio Cef] = Realizado CEF − Projetado CEF

  const atualFisico = {
    avancoMes: v(referencia, 'realizadoMes'),
    avancoAcm: v(referencia, 'realizadoAcm'),
    cronograma: v(referencia, 'previstoOriginalAcm'),
    previsto: v(referencia, 'replanAcm'),
  };
  atualFisico.desvio = subtrair(atualFisico.avancoAcm, atualFisico.previsto); // DAX [Desvio Físico]

  const seguinteCef = {
    projetadoMes: cef(v(seguinte, 'cefRealizadoMes')),
    projetadoAcm: cef(v(seguinte, 'cefRealizadoAcm')),
    cronograma: cef(v(seguinte, 'cefCronogramaAcm')),
    previsto: cef(v(seguinte, 'cefPrevistoAcm')),
  };
  seguinteCef.desvio = seguinteCef.projetadoAcm - seguinteCef.previsto; // DAX [Desvio CEF prox mes]

  // Físico do mês seguinte: o projetado é a meta que a obra assumiu para o mês subsequente
  // (BD_Infos Gerais do mês de referência) e o previsto é o replanejado atual do mês seguinte.
  const seguinteFisico = {
    projetadoMes: v(referencia, 'metaMesSubsequente'),
    projetadoAcm: v(referencia, 'metaAcmSubsequente'),
    cronograma: v(seguinte, 'previstoOriginalAcm'),
    previsto: v(seguinte, 'replanAcm'),
  };
  seguinteFisico.desvio = subtrair(seguinteFisico.projetadoAcm, seguinteFisico.previsto);

  return { temCef, referencia, seguinte, atual: { cef: atualCef, fisico: atualFisico }, proximo: { cef: seguinteCef, fisico: seguinteFisico } };
}

/** Bloco "Análise Econômica" (BD_Econômico, item Geral, no mês de referência). */
export function analiseEconomica(base, obras, referencia) {
  const geral = obras.map((chave) => economicoDoMes(base, chave, referencia));
  const soma = (campo) => somar(geral.map((l) => l?.[campo] ?? null));
  const orcado = somar(obras.map((chave) => orcamentoGeral(base, chave))); // [Orçamento Geral]
  const projetado = soma('custoProjetado'); // [Valor Geral Custo Projetado Total]
  const indireto = somar(obras.map((chave) => economicoDoMes(base, chave, referencia, ITEM_INDIRETO)?.custoProjetado ?? null));
  const totalAditivos = soma('totalAditivos');
  const aditivosAAprovar = soma('aditivosSemAprovacao');
  return {
    orcado,
    projetado,
    desvio: subtrair(orcado, projetado), // [desvio R$]
    iec: indiceIec(geral),
    percIndireto: dividir(indireto, projetado), // [% indireto]
    custoPagoAPagar: somar([soma('custoPago'), soma('nfsLancadas')]), // [custo pago e a pagar]
    saldosOcContratos: somar([soma('saldosOC'), soma('saldosContratos')]),
    orcamentoTermino: soma('orcamentoTermino'),
    passivelReajuste: soma('custoPassivelReajuste'),
    totalAditivos,
    aditivosAprovados: subtrair(totalAditivos, aditivosAAprovar),
    aditivosAAprovar,
    custosNaoIncidentes: soma('custosForaContrato'),
  };
}

/**
 * IEC = custo projetado ÷ orçado (orçado = custo projetado + resultado projetado), conferido com a
 * planilha Resumo Econômico (AP = AN ÷ X). Com uma obra devolve a própria coluna "IEC Obra".
 */
export function indiceIec(linhasGeral) {
  const validas = linhasGeral.filter(Boolean);
  if (validas.length === 1) return validas[0].iec ?? null;
  const projetado = somar(validas.map((l) => l.custoProjetado));
  const orcado = somar(validas.map((l) => somar([l.custoProjetado, l.resultadoProjetado])));
  return dividir(projetado, orcado);
}

/**
 * "Custos por" (sem correção): custo = Orçamento Geral − Resultado Sem Correção
 * ([custos por/resultado sem correção]), dividido por UH, área equivalente, privativa e construída
 * do cadastro da obra.
 */
export function custosPorUnidade(base, obras, referencia) {
  const custo = somar(obras.map((chave) => subtrair(
    orcamentoGeral(base, chave),
    economicoDoMes(base, chave, referencia)?.resultadoSemCorrecao ?? null,
  )));
  const cadastro = (campo) => somar(obras.map((chave) => base.cadastro.get(chave)?.[campo] ?? null));
  return {
    custo,
    uh: dividir(custo, cadastro('numeroUH')),
    ae: dividir(custo, cadastro('areaEquivalente')),
    ap: dividir(custo, cadastro('areaPrivativaTotal')),
    ac: dividir(custo, cadastro('areaConstruida')),
  };
}

/**
 * INCC: índice-base do orçamento (cadastro) e reajuste acumulado até o mês de referência.
 * O Power BI calculava [INCC Base] ÷ [INCC Mês]; aqui o reajuste é atual ÷ base − 1 (positivo quando o
 * índice sobe). Só faz sentido para uma obra; com várias, usa a primeira com cadastro.
 */
export function indiceIncc(base, obras, referencia) {
  const atual = inccDoMes(base, referencia);
  const chave = obras.find((c) => base.cadastro.get(c)?.inccBase || base.cadastro.get(c)?.dataBaseIncc);
  const cadastro = chave ? base.cadastro.get(chave) : null;
  const indiceBase = cadastro?.inccBase ?? inccDoMes(base, cadastro?.dataBaseIncc?.slice(0, 7))?.indice ?? null;
  return {
    base: indiceBase,
    dataBase: cadastro?.dataBaseIncc ?? null,
    atual: atual?.indice ?? null,
    mesAtual: atual?.mes ?? null,
    reajuste: indiceBase && atual?.indice ? atual.indice / indiceBase - 1 : null,
  };
}

/**
 * NH-NU — medida [nhnu calculado] do Power BI, mantida como pedido:
 * Homens/mês × Nº de UH × Realizado Mês ÷ 100. Somada entre obras.
 */
export function nhnu(base, obras, referencia) {
  return somar(obras.map((chave) => {
    const info = infoDoMes(base, chave, referencia);
    const uh = base.cadastro.get(chave)?.numeroUH;
    if (!info || typeof info.homens !== 'number' || typeof uh !== 'number' || typeof info.realizadoMes !== 'number') return null;
    return (info.homens * uh * info.realizadoMes) / 100;
  }));
}
