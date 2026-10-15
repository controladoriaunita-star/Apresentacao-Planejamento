/**
 * Séries mensais dos gráficos (uma ou várias obras), com as regras de exibição do Power BI.
 */
import { orcamentoGeral } from './base.js';
import { mediaPonderada } from './agregar.js';

/**
 * Série de um campo de BD_Infos Gerais, agregada entre obras pela média ponderada pelo orçamento.
 * @returns {Array<number|null>} um valor por mês de `meses`
 */
export function serieInfos(base, chaves, meses, campo) {
  return meses.map((mes) => mediaPonderada(chaves.map((chave) => ({
    valor: base.infos.get(chave)?.get(mes)?.[campo] ?? null,
    peso: orcamentoGeral(base, chave),
  }))));
}

/**
 * Replica as medidas "(Sem Repetição)" do Power BI: um valor que já apareceu mais de `limite` vezes até
 * aquele mês vira lacuna. Serve para a curva parar quando a planilha repete o último valor nos meses
 * futuros (ex.: 100%, 100%, 100%…).
 *
 * Limites usados no relatório original: Previsto Original Acm 2, Replanejado Atual Acm 3,
 * Realizado Mês 1, Replanejado Atual Mês 2, Assertividade 5, Realizado Acm 1.
 */
export function semRepeticao(valores, limite) {
  const contagem = new Map();
  return valores.map((v) => {
    if (v === null || v === undefined) return null;
    const chave = Math.round(v * 1e9); // tolera ruído de ponto flutuante do Excel
    const n = (contagem.get(chave) ?? 0) + 1;
    contagem.set(chave, n);
    return n > limite ? null : v;
  });
}

/**
 * Versão usada nos gráficos: só corta a sequência repetida no FIM da série (ex.: 100%, 100%, 100%…
 * ou 0%, 0%… depois que a obra termina), mantendo `limite` ocorrências. A regra original do Power BI
 * (`semRepeticao`) também apagava meses do meio com o mesmo valor — ex.: planejado de 5% todo mês.
 */
export function semRepeticaoNoFim(valores, limite) {
  const resultado = [...valores];
  let fim = resultado.length - 1;
  while (fim >= 0 && (resultado[fim] === null || resultado[fim] === undefined)) fim--;
  if (fim < 0) return resultado;
  const ultimo = Math.round(resultado[fim] * 1e9);
  let inicio = fim;
  while (inicio > 0 && typeof resultado[inicio - 1] === 'number' && Math.round(resultado[inicio - 1] * 1e9) === ultimo) inicio--;
  for (let i = inicio + limite; i <= fim; i++) resultado[i] = null;
  return resultado;
}

/** Valores do realizado só existem até o mês de referência (o resto da planilha é projeção). */
export function cortarApos(valores, meses, mesLimite) {
  return valores.map((v, i) => (meses[i] > mesLimite ? null : v));
}

export const LIMITES_SEM_REPETICAO = Object.freeze({
  previstoOriginalAcm: 2,
  replanAcm: 3,
  realizadoMes: 1,
  replanMes: 2,
  assertividade: 5,
  realizadoAcm: 1,
});
