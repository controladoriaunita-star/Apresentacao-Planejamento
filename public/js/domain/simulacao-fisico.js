/**
 * Simulação do Resumo Físico sem algumas atividades ("qual seria o desvio se eu retirasse a Estrutura?").
 *
 * O avanço da obra é a média dos itens pai ponderada pelo orçamento (peso = orçamento do item ÷ soma dos
 * orçamentos dos itens pai — conferido com as planilhas reais). Retirar atividades tira a contribuição delas
 * e redistribui o peso entre as demais:
 *
 *   simulado = (total oficial − Σ peso × valor do item) ÷ (1 − Σ peso)
 *
 * Partir do total oficial garante que, sem nada retirado, a simulação é igual à linha oficial.
 * Cada coluna só é simulada se os itens pai "fecham" com o total (Σ peso × valor ≈ total, tolerância de
 * 1 p.p.): em algumas obras a planilha traz nas atividades o acumulado na coluna do mês, e descontar esse
 * valor daria números sem sentido. Essas colunas saem vazias e listadas em `semConciliar`.
 * Não altera nenhum cálculo do Resumo Físico: só lê o resultado de calcularResumoFisico().
 */
import { dividir, subtrair } from './agregar.js';
import { ehFilho, itemPai } from './resumo-fisico.js';

/** Percentuais ponderáveis da linha (mês de referência e mês seguinte). */
const CAMPOS = ['realizadoAcm', 'realizadoMes', 'planejadoInicial', 'planejadoAcm', 'planejadoMes', 'cronograma'];
const CAMPOS_PROXIMO = ['planejadoMes', 'planejadoAcm', 'previsto'];
const TOLERANCIA = 0.01; // 1 p.p. entre o total e a soma ponderada dos itens

/** Só dá para retirar o que tem orçamento (sem orçamento não há peso). */
export const podeRetirar = (linha) => typeof linha.orcamento === 'number' && linha.orcamento > 0;

/** Desvio da meta: realizado acumulado − planejado acumulado (meta). */
export const desvioDaMeta = (linha) => subtrair(linha?.realizadoAcm, linha?.planejadoAcm);

/**
 * @param {object} resumo  resultado de calcularResumoFisico()
 * @param {Set<string>} retirados  códigos de item (pai ou filho)
 * @returns {null | { itens: object[], pesoRetirado: number, linha: object|null, semConciliar: string[] }}
 *   null quando não há o que simular; `linha` null quando todo o peso da obra foi retirado.
 */
export function simularSemItens(resumo, retirados) {
  const { total, linhas } = resumo;
  const pais = linhas.filter((l) => l.nivel === 1 && podeRetirar(l));
  const orcamentoPais = pais.reduce((s, l) => s + l.orcamento, 0);
  // Filho de um pai já retirado não conta de novo: o pai já leva o peso dele.
  const itens = linhas.filter((l) => retirados.has(l.item) && podeRetirar(l)
    && !(ehFilho(l.item) && retirados.has(itemPai(l.item))));
  if (!total || !itens.length || !orcamentoPais) return null;

  const pesos = itens.map((l) => ({ linha: l, peso: l.orcamento / orcamentoPais }));
  const pesoRetirado = pesos.reduce((s, p) => s + p.peso, 0);
  const restante = 1 - pesoRetirado;
  if (restante <= 1e-9) return { itens, pesoRetirado, linha: null, semConciliar: [] };

  const semConciliar = [];
  const ponderar = (lista, valorItem) => lista.reduce((s, l) => s + (l.orcamento / orcamentoPais) * (valorItem(l) ?? 0), 0);
  const semItens = (campo, valorTotal, valorItem) => {
    if (typeof valorTotal !== 'number') return null;
    if (Math.abs(ponderar(pais, valorItem) - valorTotal) > TOLERANCIA) {
      semConciliar.push(campo);
      return null;
    }
    return (valorTotal - pesos.reduce((s, p) => s + p.peso * (valorItem(p.linha) ?? 0), 0)) / restante;
  };
  const atual = Object.fromEntries(CAMPOS.map((c) => [c, semItens(c, total[c], (l) => l[c])]));
  const proximo = Object.fromEntries(CAMPOS_PROXIMO.map((c) => [c, semItens(`proximo.${c}`, total.proximo[c], (l) => l.proximo[c])]));
  const somaRetirada = (valor) => itens.reduce((s, l) => s + (valor(l) ?? 0), 0);
  // O econômico só existe nos itens pai; com um filho retirado não dá para descontar a parte dele.
  const orcamentoProjetado = total.economico && itens.every((l) => l.economico)
    ? subtrair(total.economico.orcamentoProjetado, somaRetirada((l) => l.economico.orcamentoProjetado))
    : null;

  return {
    itens,
    pesoRetirado,
    semConciliar,
    linha: {
      ...atual,
      orcamento: subtrair(total.orcamento, somaRetirada((l) => l.orcamento)),
      acerto: dividir(atual.realizadoMes, atual.planejadoMes),
      adiantamento: subtrair(atual.realizadoAcm, atual.cronograma),
      proximo: { ...proximo, adiantamento: subtrair(proximo.planejadoAcm, proximo.previsto) },
      economico: { orcamentoProjetado, iec: null },
      pesoAtraso: null,
      pesoPlanejado: null,
    },
  };
}
