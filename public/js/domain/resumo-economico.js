/**
 * Aba "Resumo Econômico" — página "IEC" do Power BI e planilha "Resumo Econômico" (aba IEC):
 * uma linha por item do BD_Econômico no mês de referência, com a linha Geral como total.
 */
import { economicoDoMes } from './base.js';
import { ITEM_GERAL } from './colunas.js';
import { compararItens } from './resumo-fisico.js';

/**
 * Colunas principais da tabela, agrupadas como no Resumo Físico (linha de grupos no cabeçalho).
 * `grupo` = título da faixa acima das colunas.
 */
export const COLUNAS_ECONOMICO = [
  { campo: 'avanco', titulo: 'Avanço', tipo: 'percentual', grupo: 'Execução' },
  { campo: 'custoLancado', titulo: 'Custo lançado', tipo: 'moeda', grupo: 'Execução' },
  { campo: 'orcamentoTermino', titulo: 'Orç. de término', tipo: 'moeda', grupo: 'Projeção' },
  { campo: 'custoProjetado', titulo: 'Custo projetado total', tipo: 'moeda', grupo: 'Projeção' },
  { campo: 'resultadoProjetado', titulo: 'Resultado projetado', tipo: 'moeda', sinal: true, grupo: 'Resultado' },
  { campo: 'iec', titulo: 'IEC', tipo: 'indice', grupo: 'Resultado' },
  { campo: 'resultadoSemCorrecao', titulo: 'Resultado s/ correção', tipo: 'moeda', sinal: true, grupo: 'Sem correção' },
  { campo: 'iecSemCorrecao', titulo: 'IEC s/ correção', tipo: 'indice', grupo: 'Sem correção' },
  { campo: 'percContratado', titulo: '% contratado', tipo: 'percentual', grupo: 'Contratação' },
];

/**
 * Valores do detalhe de cada item (ao expandir), em 3 linhas de 4 caixas — grade simétrica.
 */
export const DETALHES_ECONOMICO = [
  { titulo: 'Custos', campos: [
    { campo: 'custoPago', titulo: 'Custo pago', tipo: 'moeda' },
    { campo: 'nfsLancadas', titulo: 'NFs lançadas', tipo: 'moeda' },
    { campo: 'custoEmSistema', titulo: 'Custo em sistema', tipo: 'moeda' },
    { campo: 'comprometimentos', titulo: 'Comprometimentos e rateios', tipo: 'moeda' },
  ] },
  { titulo: 'Saldos', campos: [
    { campo: 'saldosOC', titulo: 'Saldos OC', tipo: 'moeda' },
    { campo: 'saldosContratos', titulo: 'Saldos contratos', tipo: 'moeda' },
    { campo: 'saldoOrcamento', titulo: 'Saldo de orçamento', tipo: 'moeda' },
    { campo: 'custoPassivelReajuste', titulo: 'Passível de reajuste', tipo: 'moeda' },
  ] },
  { titulo: 'Mês e aditivos', campos: [
    { campo: 'custoLancadoMes', titulo: 'Custo lançado mês', tipo: 'moeda' },
    { campo: 'custoPagoMes', titulo: 'Custo pago mês', tipo: 'moeda' },
    { campo: 'variacaoMesCusto', titulo: 'Variação mês', tipo: 'moeda', sinal: true },
    { campo: 'totalAditivos', titulo: 'Total de aditivos', tipo: 'moeda' },
  ] },
];

/** Indicadores do topo e do rodapé da página IEC do Power BI (item Geral). */
export const INDICADORES_ECONOMICO = {
  topo: [
    ['avanco', 'Avanço', 'percentual'],
    ['custoLancado', 'Custo lançado', 'moeda'],
    ['orcamentoTermino', 'Orç. de término', 'moeda'],
    ['custoProjetado', 'Custo projetado', 'moeda'],
    ['resultadoProjetado', 'Resultado projetado', 'moeda'],
    ['iec', 'IEC', 'indice'],
    ['resultadoSemCorrecao', 'Resultado s/ correção', 'moeda'],
    ['iecSemCorrecao', 'IEC s/ correção', 'indice'],
    ['percContratado', '% contratado', 'percentual'],
  ],
  rodape: [
    ['custoPagoMes', 'Custo pago no mês', 'moeda'],
    ['custoPassivelReajuste', 'Custo passível de reajuste', 'moeda'],
    ['totalAditivos', 'Total em aditivos', 'moeda'],
    ['aditivosSemAprovacao', 'Aditivos à aprovar', 'moeda'],
    ['custosForaContrato', 'Custos não incidentes', 'moeda'],
    ['variacaoMesCusto', 'Variação de custo (mês)', 'moeda'],
  ],
};

export function calcularResumoEconomico(base, chave, referencia) {
  const porItem = base.economico.get(chave)?.get(referencia) ?? new Map();
  const itens = [...porItem.keys()].filter((i) => i !== ITEM_GERAL).sort(compararItens);
  return {
    referencia,
    geral: economicoDoMes(base, chave, referencia),
    linhas: itens.map((item) => {
      const linha = porItem.get(item);
      return {
        ...linha,
        // Comentários do item (no Power BI apareciam em tooltip/página "Comentário IEC").
        comentarios: [
          ['Variações principais', linha.variacoesPrincipais],
          ['Variação do mês', linha.variacaoDoMes],
          ['Contingências', linha.contingencias],
        ].filter(([, t]) => t),
      };
    }),
    mesesDisponiveis: [...(base.economico.get(chave)?.keys() ?? [])].sort(),
  };
}
