/**
 * Regras de agregação quando o filtro tem mais de uma obra.
 *
 * O Power BI usava MAX() em quase todas as medidas, o que não faz sentido com várias obras
 * (mostrava o maior valor de qualquer obra). Aqui:
 * - percentuais (curvas, avanço, assertividade, CEF): média ponderada pelo orçamento base físico da obra;
 * - valores em R$: soma;
 * - índices (IEC): recalculados a partir das somas (Σ custo projetado ÷ Σ orçado).
 * Com uma obra só, todas as regras devolvem o próprio valor da obra (mesmo resultado do Power BI).
 */

/** Soma ignorando nulos; `null` se nenhum valor existir. */
export function somar(valores) {
  let total = 0;
  let algum = false;
  for (const v of valores) {
    if (typeof v === 'number' && Number.isFinite(v)) { total += v; algum = true; }
  }
  return algum ? total : null;
}

/**
 * Média ponderada ignorando valores nulos (o peso da obra sem valor não entra no divisor).
 * @param {Array<{valor: number|null, peso: number|null}>} itens
 */
export function mediaPonderada(itens) {
  let soma = 0;
  let pesos = 0;
  for (const { valor, peso } of itens) {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) continue;
    const p = typeof peso === 'number' && peso > 0 ? peso : 1;
    soma += valor * p;
    pesos += p;
  }
  return pesos > 0 ? soma / pesos : null;
}

/** Divisão segura (equivalente ao DIVIDE do DAX): `null` quando o divisor é zero ou nulo. */
export function dividir(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number' || b === 0) return null;
  return a / b;
}

/** Diferença segura: `null` se algum lado faltar. */
export function subtrair(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return a - b;
}
