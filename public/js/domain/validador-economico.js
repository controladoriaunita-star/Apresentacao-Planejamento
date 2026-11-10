/**
 * Validador do econômico do mês: a planilha BD_Econômico costuma repetir o último fechamento nos meses
 * seguintes (mesmos valores copiados). Aqui se descobre de qual mês é, de fato, o relatório exibido
 * (competência real) e se ele é o último econômico disponível da obra.
 */
import { CAMPOS_DATA, CAMPOS_ECONOMICO, CAMPOS_TEXTO } from './colunas.js';

const CAMPOS_NUMERICOS = CAMPOS_ECONOMICO.map(([campo]) => campo).filter((c) => !CAMPOS_TEXTO.has(c) && !CAMPOS_DATA.has(c));

/** Assinatura do mês: todos os valores numéricos de todos os itens (centavos, tolera ruído do Excel). */
function assinatura(porItem) {
  return [...porItem.keys()].sort()
    .map((item) => `${item}:${CAMPOS_NUMERICOS.map((c) => {
      const v = porItem.get(item)[c];
      return typeof v === 'number' ? Math.round(v * 100) : '';
    }).join(',')}`)
    .join(';');
}

/**
 * @returns {null | { referencia: string, competenciaReal: string, repetido: boolean, ultimo: boolean, maisRecente: string|null }}
 *   null quando a obra não tem econômico no mês. `competenciaReal` = primeiro mês da sequência de meses
 *   idênticos que termina na referência; `maisRecente` = competência real do último econômico distinto
 *   da obra quando ele é posterior ao exibido (senão null, e `ultimo` = true).
 */
export function validarEconomico(base, chave, referencia) {
  const porMes = base.economico.get(chave);
  if (!porMes?.get(referencia)?.size) return null;
  const meses = [...porMes.keys()].filter((m) => porMes.get(m).size).sort();
  const assinaturas = new Map(meses.map((m) => [m, assinatura(porMes.get(m))]));
  /** Primeiro mês da sequência de meses consecutivos (na lista) com a mesma assinatura de `mes`. */
  const competencia = (mes) => {
    let i = meses.indexOf(mes);
    while (i > 0 && assinaturas.get(meses[i - 1]) === assinaturas.get(mes)) i--;
    return meses[i];
  };
  const competenciaReal = competencia(referencia);
  const ultimaCompetencia = competencia(meses.at(-1));
  const ultimo = ultimaCompetencia <= competenciaReal;
  return {
    referencia,
    competenciaReal,
    repetido: competenciaReal !== referencia,
    ultimo,
    maisRecente: ultimo ? null : ultimaCompetencia,
  };
}
