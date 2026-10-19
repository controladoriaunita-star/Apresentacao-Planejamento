/**
 * Painel de Obras (Início) — réplica da aba "Painel" da planilha Painel de Obras.xlsm.
 *
 * De onde vem cada coluna (equivalência planilha → app):
 *   BD_Fixo          → cadastro de obras do app (Administração → Cadastro de obras)
 *   BD_Físico Geral  → BD_Infos Gerais (item Geral), mês de referência; colunas "- Cliente" pela base da visão Cliente
 *   BD_Econômico     → BD_Econômico (item Geral), mês de referência
 *   Orçamento raso   → BD_Orc (item Geral, "Orçamento Base Físico") — o BD_Fixo da planilha soma direto + indireto
 *   INCC (célula J8) → série INCC do app no mês de referência
 *
 * Colunas da planilha sem fonte confiável não entram no painel até termos a origem: Persona sem emissão,
 * Taxa emitida/a receber, Taxa recebida/projeção, Regime, Taxa mês e Taxa projetada (na planilha dependem de
 * linhas mensais com #REF! ou são valores digitados).
 */
import { economicoDoMes, infoDoMes, inccDoMes, orcamentoGeral } from './base.js';
import { dataIso, numero } from './normalizar.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const div = (a, b) => (num(a) !== null && num(b) ? a / b : null);

/** DATEDIF(inicio; fim; "m") do Excel: meses completos; `null` se faltar data ou se fim < início (#NUM!). */
export function mesesCompletos(inicio, fim) {
  const a = dataIso(inicio);
  const b = dataIso(fim);
  if (!a || !b || b < a) return null;
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma) - (db < da ? 1 : 0);
}

/** Status das colunas Físico Cliente/Obra: desvio < 0 atrasada, > 0 adiantada, 0 OK. */
export function statusDesvio(desvio) {
  if (num(desvio) === null) return null;
  return desvio < 0 ? 'Atrasada' : desvio > 0 ? 'Adiantada' : 'OK';
}

const desvio = (valor, referencia) => (num(valor) !== null && num(referencia) !== null ? valor - referencia : null);

/**
 * Uma linha do painel por obra do cadastro.
 * @param {object} base         base da visão Obra
 * @param {object} baseCliente  base da visão Cliente (colunas "- Cliente" de BD_Infos Gerais)
 * @param {string} referencia   "AAAA-MM"
 */
export function calcularPainelObras(base, baseCliente, referencia) {
  const dataRef = `${referencia}-01`;
  const incc = inccDoMes(base, referencia);

  const linhas = [...base.cadastro.entries()].map(([chave, c]) => {
    const info = infoDoMes(base, chave, referencia);
    const infoCliente = infoDoMes(baseCliente, chave, referencia);
    const eco = economicoDoMes(base, chave, referencia);
    const orcamentoRaso = orcamentoGeral(base, chave);
    const uh = num(c.numeroUH);

    const realizadoAcm = num(info?.realizadoAcm);
    const metaAcm = num(info?.metaAcmSubsequente);
    const terminoPlanejamento = info?.fimProjetado ?? null;

    const resultado = num(eco?.resultadoProjetado);
    const resultadoSemCorrecao = num(eco?.resultadoSemCorrecao);
    const custoCorrigido = num(orcamentoRaso) !== null && resultado !== null ? orcamentoRaso - resultado : null;
    const custoSemCorrecao = num(orcamentoRaso) !== null && resultadoSemCorrecao !== null ? orcamentoRaso - resultadoSemCorrecao : null;

    const inccBase = num(c.inccBase);
    const correcaoIncc = inccBase && num(incc?.indice) !== null ? (incc.indice - inccBase) / inccBase : null;
    // Custo por área/UH = custo total corrigido ÷ área × (1 + correção INCC), como na planilha.
    const custoPor = (divisor) => (custoCorrigido !== null && num(divisor) && correcaoIncc !== null ? (custoCorrigido / divisor) * (1 + correcaoIncc) : null);

    const banda = num(c.temBanda);
    const taxaPrevista = num(c.taxaAdmInicial);
    const orcamentoComTaxa = num(c.orcamentoComTaxa);
    const ajusteTaxa = resultado !== null && orcamentoComTaxa !== null && banda !== null ? Math.max(0, resultado - orcamentoComTaxa * banda) : null;

    const cliente = {
      realOriginal: desvio(realizadoAcm, infoCliente?.previstoOriginalAcm),
      realAtual: desvio(realizadoAcm, infoCliente?.replanAcm),
      metaOriginal: desvio(metaAcm, infoCliente?.previstoOriginalAcm),
      metaAtual: desvio(metaAcm, infoCliente?.replanAcm),
    };
    const obra = {
      realOriginal: desvio(realizadoAcm, info?.previstoOriginalAcm),
      realAtual: desvio(realizadoAcm, info?.replanAcm),
      metaAtual: desvio(metaAcm, info?.replanAcm),
    };

    return {
      chave,
      cliente: c.cliente ?? null,
      obra: c.obra,
      temFechamento: Boolean(info),
      geral: {
        orcamentoRaso: num(orcamentoRaso), orcamentoComTaxa, uh,
        sistemaEstrutural: c.sistemaEstrutural ?? null, tipologia: c.tipologia ?? null, torres: num(c.numeroTorres),
        fundacao: c.fundacao ?? null, segmento: c.padrao ?? null, endereco: c.endereco ?? null, cidade: c.cidade ?? null,
      },
      gestao: {
        diretor: c.diretoria ?? null, gerente: c.gestao ?? null, coordenador: c.coordenador ?? null,
        engenheiro: c.engenharia ?? null, planejamento: c.planejamento ?? null,
      },
      datas: {
        inicio: c.inicioObra ?? null, mesesIncorridos: mesesCompletos(c.inicioObra, dataRef),
        terminoContrato: c.fimObraIncorporador ?? null, duracaoContrato: mesesCompletos(c.inicioObra, c.fimObraIncorporador),
        terminoCliente: c.fimObraCliente ?? null, duracaoCliente: mesesCompletos(c.inicioObra, c.fimObraCliente),
        terminoProjetado: c.fimProjetadoReal ?? null, duracaoProjetada: mesesCompletos(c.inicioObra, c.fimProjetadoReal),
      },
      realizado: {
        avancoAcm: realizadoAcm, avancoMes: num(info?.realizadoMes),
        assertividade: num(info?.assertividade), metaMes: num(info?.metaMesInicial),
      },
      meta: { acumulada: metaAcm, mes: num(info?.metaMesSubsequente) },
      fisicoCliente: cliente,
      fisicoObra: { termino: c.fimObraMeta ?? null, mesesRestantes: mesesCompletos(dataRef, c.fimObraMeta), ...obra },
      projecao: { termino: terminoPlanejamento, mesesRestantes: mesesCompletos(dataRef, terminoPlanejamento) },
      economico: {
        iec: num(eco?.iec), resultado,
        iecSemCorrecao: num(eco?.iecSemCorrecao), resultadoSemCorrecao,
        custoCorrigido, custoSemCorrecao,
        totalAditivos: num(eco?.totalAditivos), aditivosAAprovar: num(eco?.aditivosSemAprovacao),
        custosForaContrato: num(eco?.custosForaContrato) === null ? null : -eco.custosForaContrato || 0, // sinal invertido como na planilha (sem "-0")
        contingencia: numero(eco?.contingencias),
        inccOrcamento: inccBase, correcaoIncc,
      },
      areas: {
        privativa: num(c.areaPrivativaTotal), custoPrivativa: custoPor(c.areaPrivativaTotal),
        custoUh: custoPor(uh),
        privativaMedia: div(c.areaPrivativaTotal, uh),
        construida: num(c.areaConstruida), custoConstruida: custoPor(c.areaConstruida),
        equivalente: num(c.areaEquivalente), custoEquivalente: custoPor(c.areaEquivalente),
      },
      taxa: {
        prevista: taxaPrevista, percentual: num(c.taxaPercentual),
        banda,
        ajuste: ajusteTaxa, ajustePercentual: div(ajusteTaxa, taxaPrevista),
      },
    };
  });

  linhas.sort((a, b) => (a.cliente ?? '').localeCompare(b.cliente ?? '', 'pt-BR') || a.obra.localeCompare(b.obra, 'pt-BR'));
  return { referencia, incc: num(incc?.indice), linhas };
}
