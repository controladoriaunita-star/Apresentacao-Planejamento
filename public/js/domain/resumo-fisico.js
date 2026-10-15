/**
 * Aba "Resumo Físico" — mesma estrutura da planilha "Resumo Físico" (aba Resumo Obra) e da matriz do
 * Power BI: itens pai/filho da EAP, mês de referência e projeção para o mês seguinte.
 *
 * Conferência com a planilha (linha 27, ESTRUTURA): % Acerto = Realizado Mês ÷ Planejado Mês;
 * Adiant. = Realizado Acm − Cronograma; Planejado Acm seguinte = Realizado Acm + Planejado Mês seguinte;
 * Adiant. seguinte = Planejado Acm seguinte − Previsto (replanejado do mês seguinte).
 */
import { economicoDoMes, infoDoMes, orcamentoGeral } from './base.js';
import { dividir, subtrair } from './agregar.js';
import { ITEM_GERAL } from './colunas.js';
import { mesSeguinte } from './periodo.js';

/** "04.01" → pai "04"; "04" → pai "04". */
export const itemPai = (item) => String(item).split('.')[0];
export const ehFilho = (item) => String(item).includes('.');

/** Ordena códigos de EAP numericamente: 2 < 10, "04" < "04.01" < "04.02". */
export function compararItens(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d !== 0) return Number.isNaN(d) ? String(a).localeCompare(String(b)) : d;
  }
  return 0;
}

/**
 * @param {object} base  criarBase(...)
 * @param {Map<string, Map<string, object>>} fisico  criarFisicoAtividade(...) da obra
 * @param {string} chave  obra
 * @param {string} referencia  "AAAA-MM"
 */
export function calcularResumoFisico(base, fisico, chave, referencia) {
  const seguinte = mesSeguinte(referencia);
  const orcamentoItens = base.orcamento.get(chave) ?? new Map();
  const linhas = [];

  for (const item of [...fisico.keys()].sort(compararItens)) {
    if (item === ITEM_GERAL) continue;
    const atual = fisico.get(item).get(referencia);
    if (!atual) continue;
    const proximo = fisico.get(item).get(seguinte);
    const orc = orcamentoItens.get(item);
    linhas.push(montarLinha({
      item,
      nivel: ehFilho(item) ? 2 : 1,
      descricao: orc?.descricao ?? null,
      orcamento: orc?.orcamento ?? null,
      atual,
      previstoSeguinte: proximo?.replanAcm ?? null,
      economico: ehFilho(item) ? null : economicoDoMes(base, chave, referencia, item),
    }));
  }

  return {
    referencia,
    seguinte,
    total: linhaTotal(base, chave, referencia, seguinte),
    linhas,
  };
}

function montarLinha({ item, nivel, descricao, orcamento, atual, previstoSeguinte, economico }) {
  const planejadoAcmSeguinte = atual.metaAcmSubsequente;
  return {
    item,
    nivel,
    descricao,
    orcamento,
    realizadoAcm: atual.realizadoAcm,
    realizadoMes: atual.realizadoMes,
    planejadoInicial: atual.metaAcmInicial,
    planejadoAcm: atual.metaAcmAtual,
    planejadoMes: atual.metaMesAtual,
    acerto: atual.assertividade ?? dividir(atual.realizadoMes, atual.metaMesAtual),
    cronograma: atual.replanAcm,
    adiantamento: subtrair(atual.realizadoAcm, atual.replanAcm), // [Atraso/Adiantamento]
    proximo: {
      planejadoMes: atual.metaMesSubsequente,
      planejadoAcm: planejadoAcmSeguinte,
      previsto: previstoSeguinte ?? atual.replanAcm,
      adiantamento: subtrair(planejadoAcmSeguinte, previstoSeguinte ?? atual.replanAcm), // [Atraso projetado]
    },
    pesoAtraso: atual.pesoAtraso,
    pesoPlanejado: atual.pesoPlanejado,
    comentario: atual.comentario,
    economico: economico ? {
      orcamentoProjetado: economico.custoProjetado,
      resultado: economico.resultadoProjetado,
      iec: economico.iec,
    } : null,
  };
}

/** Linha "Geral" a partir de BD_Infos Gerais e BD_Econômico. */
function linhaTotal(base, chave, referencia, seguinte) {
  const info = infoDoMes(base, chave, referencia);
  const infoSeguinte = infoDoMes(base, chave, seguinte);
  if (!info) return null;
  const econ = economicoDoMes(base, chave, referencia);
  return {
    item: ITEM_GERAL,
    nivel: 0,
    descricao: base.obras.find((o) => o.chave === chave)?.nome ?? null,
    orcamento: orcamentoGeral(base, chave),
    realizadoAcm: info.realizadoAcm,
    realizadoMes: info.realizadoMes,
    planejadoInicial: info.metaAcmInicial,
    planejadoAcm: info.metaAcmAtual,
    planejadoMes: info.metaMesAtual,
    acerto: info.assertividade,
    cronograma: info.replanAcm,
    adiantamento: subtrair(info.realizadoAcm, info.replanAcm),
    proximo: {
      planejadoMes: info.metaMesSubsequente,
      planejadoAcm: info.metaAcmSubsequente,
      previsto: infoSeguinte?.replanAcm ?? info.replanAcm,
      adiantamento: subtrair(info.metaAcmSubsequente, infoSeguinte?.replanAcm ?? info.replanAcm),
    },
    pesoAtraso: null,
    pesoPlanejado: null,
    comentario: info.comentario,
    principaisMetas: info.principaisMetas,
    consideracaoMes: info.consideracaoMes,
    economico: econ ? { orcamentoProjetado: econ.custoProjetado, resultado: econ.resultadoProjetado, iec: econ.iec } : null,
  };
}
