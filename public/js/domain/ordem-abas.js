/**
 * v28 — Ordem das abas do menu superior das apresentações. O Dev arrasta as abas no Resumo Geral com
 * "Editar layout" ligado e a ordem salva vale para todas as apresentações (Obra e Cliente).
 * A ordem é uma lista de ids: abas fixas (`resumo-geral`, `fotos`…) e telas extras (`tela-<id>`).
 * Módulo puro: usado pelo front (menu e edição) e pelo servidor (validação).
 */

/** Limites da lista recebida (proteção contra corpo exagerado). */
const MAX_ABAS = 200;
const MAX_ID = 120;

/** Lista de ids sem repetição e só com textos válidos; qualquer outra entrada vira lista vazia. */
export function normalizarOrdemAbas(entrada) {
  if (!Array.isArray(entrada)) return [];
  const ids = entrada.filter((id) => typeof id === 'string' && id.trim() && id.length <= MAX_ID).map((id) => id.trim());
  return [...new Set(ids)].slice(0, MAX_ABAS);
}

/**
 * Ordena `itens` pela ordem salva. Itens que não estão na lista (aba ou tela nova) mantêm a ordem natural
 * e vão para o fim. Sem ordem salva, devolve a ordem natural.
 * @param {object[]} itens
 * @param {string[]|null|undefined} ordem
 * @param {(item: object) => string} idDe
 */
export function ordenarAbas(itens, ordem, idDe = (item) => item.id) {
  const posicao = new Map(normalizarOrdemAbas(ordem).map((id, i) => [id, i]));
  if (!posicao.size) return [...itens];
  const peso = (item, i) => posicao.get(idDe(item)) ?? posicao.size + i;
  return itens.map((item, i) => ({ item, p: peso(item, i) })).sort((a, b) => a.p - b.p).map(({ item }) => item);
}
