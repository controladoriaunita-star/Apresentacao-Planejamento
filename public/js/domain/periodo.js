/**
 * Mês de referência ("mês do fechamento") e intervalo padrão do filtro de período.
 *
 * As planilhas trazem 36 meses por obra, inclusive os futuros (com o realizado repetido ou zerado).
 * O mês fechado de uma obra é o último em que houve avanço realizado no mês.
 */
import { mesesDasObras } from './base.js';
import { somarMeses } from './normalizar.js';

/** Último mês em que a obra teve "Realizado Mês" > 0, limitado a `ate` (inclusive). */
export function ultimoMesFechado(base, chave, ate = null) {
  let ultimo = null;
  for (const [mes, linha] of base.infos.get(chave) ?? []) {
    if (ate && mes > ate) continue;
    if ((linha.realizadoMes ?? 0) > 0 && (!ultimo || mes > ultimo)) ultimo = mes;
  }
  return ultimo;
}

/**
 * Mês de referência padrão: o mais recente mês fechado entre as obras, sem passar do mês corrente.
 * @param {string} hoje  "AAAA-MM" (injetável para testes)
 */
export function mesReferenciaPadrao(base, chaves, hoje) {
  let ref = null;
  for (const chave of chaves) {
    const m = ultimoMesFechado(base, chave, hoje);
    if (m && (!ref || m > ref)) ref = m;
  }
  return ref ?? (mesesDasObras(base, chaves).filter((m) => m <= hoje).at(-1) ?? hoje);
}

/** Intervalo padrão dos gráficos: todos os meses das obras selecionadas. */
export function periodoPadrao(base, chaves, hoje) {
  const meses = mesesDasObras(base, chaves);
  const ref = mesReferenciaPadrao(base, chaves, hoje);
  return { de: meses[0] ?? ref, ate: meses.at(-1) ?? ref, referencia: ref };
}

/** Mês seguinte ao de referência (blocos "próximo mês" do Resumo Geral e do Resumo Físico). */
export const mesSeguinte = (mes) => somarMeses(mes, 1);

/** "AAAA-MM" do relógio local. */
export function mesAtual(data = new Date()) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}
