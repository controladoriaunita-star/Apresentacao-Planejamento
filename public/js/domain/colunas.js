/**
 * Mapa único entre os cabeçalhos das abas do Excel (SharePoint) e os nomes lógicos usados no código.
 *
 * Por que existe: os cabeçalhos têm espaços duplos, espaços no fim e variantes "Obra"/"Cliente".
 * Se alguém renomear uma coluna na planilha, só este arquivo muda.
 *
 * Cada campo é `[nomeLogico, colunaVisaoObra, colunaVisaoCliente?]`. Quando não há variante de cliente,
 * a visão Cliente usa a mesma coluna da visão Obra. A busca de cabeçalho ignora maiúsculas, acentos
 * e espaços repetidos (ver `normalizarCabecalho`).
 */

/** Nomes das abas lidas pelo Microsoft Graph (`workbook/worksheets('<aba>')/usedRange`). */
export const ABAS = Object.freeze({
  fisicoAtividade: 'BD_Físico por atividade',
  infosGerais: 'BD_Infos Gerais',
  orcamento: 'BD_Orc',
  economico: 'BD_Econômico',
});

/** Visões da apresentação: Obra (equipe interna) e Cliente (colunas "- Cliente"). */
export const VISOES = Object.freeze({ obra: 'obra', cliente: 'cliente' });

/** Item que representa o total da obra nas abas BD_Infos Gerais, BD_Econômico e BD_Orc. */
export const ITEM_GERAL = 'Geral';

/** Item do BD_Econômico que concentra os custos indiretos (medida "% indireto" do Power BI). */
export const ITEM_INDIRETO = '16';

const CHAVE = [
  ['obra', 'Nome da Obra'],
  ['cliente', 'Cliente'],
  ['uau', 'Nº Obra UAU'],
  ['item', 'Item'],
  ['mes', 'Mês do Fechamento'],
];

export const CAMPOS_INFOS_GERAIS = [
  ...CHAVE,
  ['homens', 'Homens/ mês'],
  ['houveReplanejamento', 'Houve Replanejamento?'],
  ['fimProjetado', 'Fim Projetado de obra'],
  ['previstoOriginalAcm', 'Previsto Original Acumulado - Obra', 'Previsto Original Acumulado - Cliente'],
  ['previstoOriginalMes', 'Previsto Original Mês - Obra', 'Previsto Original Mês - Cliente'],
  ['primeiroReplanAcm', '1º Replanejado Acumulado - Obra', '1º Replanejado Acumulado - Cliente'],
  ['primeiroReplanMes', '1º Replanejado Mês - Obra', '1º Replanejado Mês - Cliente'],
  ['replanAcm', 'Replanejado Atual Acumulado - Obra', 'Replanejado Atual Acumulado - Cliente'],
  ['replanMes', 'Replanejado Atual Mês - Obra', 'Replanejado Atual Mês - Cliente'],
  ['realizadoAcm', 'Realizado Acumulado'],
  ['realizadoMes', 'Realizado Mês'],
  ['metaAcmInicial', 'Meta Acumulada - Inicial'],
  ['metaAcmAtual', 'Meta Acumulada - Atual'],
  ['metaAcmSubsequente', 'Meta Acumulada - Mês Subsequente'],
  ['metaMesSubsequente', 'Meta Mês - Mês Subsequente'],
  ['metaMesInicial', 'Meta Mês - Inicial'],
  ['metaMesAtual', 'Meta Mês - Atual'],
  ['comentario', 'Comentário Obra', 'Comentário Cliente'],
  ['principaisMetas', 'Principais Metas Obra', 'Principais metas Cliente'],
  ['cefCronogramaAcm', 'Cronograma Acumulado - Banco 1ª Fase'],
  ['cefCronogramaMes', 'Cronograma Mês - Banco 1ª Fase'],
  ['cefPrevistoAcm', 'Previsto Acumulado - Banco 1ª Fase'],
  ['cefPrevistoMes', 'Previsto Mês - Banco 1ª Fase'],
  ['cefRealizadoAcm', 'Realizado/Projetado Acumulado - Banco 1ª Fase'],
  ['cefRealizadoMes', 'Realizado/Projetado Mês - Banco 1ª Fase'],
  ['consideracaoMes', 'Consideração Mês'],
  ['assertividade', 'Assertividade'],
  ['semEstruturaElevador', 'Sem estrutura e elevador'],
];

export const CAMPOS_FISICO_ATIVIDADE = [
  ...CHAVE,
  ['previstoAcm', 'Previsto Acumulado Obra', 'Previsto Acumulado Cliente'],
  ['primeiroReplanAcm', '1º Replanejado Acumulado - Obra', '1º Replanejado Acumulado - Cliente'],
  ['replanAcm', 'Replanejado Atual Acumulado - Obra', 'Replanejado Atual Acumulado - Cliente'],
  ['realizadoAcm', 'Realizado Acumulado'],
  ['realizadoMes', 'Realizado Mês'],
  ['metaMesInicial', 'Meta Mês - Inicial'],
  ['metaMesAtual', 'Meta Mês - Atual'],
  ['metaMesSubsequente', 'Meta Mês - Mês Subsequente'],
  ['assertividade', 'Assertividade'],
  ['metaAcmInicial', 'Meta Acumulada - Inicial'],
  ['metaAcmAtual', 'Meta Acumulada - Atual'],
  ['metaAcmSubsequente', 'Meta Acumulado - Mês Subsequente'],
  ['comentario', 'Comentários - Obra', 'Comentários - Cliente'],
  ['pesoPlanejado', 'Peso Planejado na Meta'],
  ['pesoAtraso', 'Peso Atraso / Adiantamento', 'Peso Atraso / Adiantamento Cliente'],
];

export const CAMPOS_ORCAMENTO = [
  ['obra', 'Nome da Obra'],
  ['cliente', 'Cliente'],
  ['uau', 'Nº Obra UAU'],
  ['item', 'ITEM'],
  ['descricao', 'Descrição'],
  ['orcamento', 'Orçamento Base Físico'],
];

export const CAMPOS_ECONOMICO = [
  ['obra', 'Nome da Obra'],
  ['item', 'Item'],
  ['descricao', 'Descrição'],
  ['mes', 'Mês do Fechamento'],
  ['avanco', 'Avanço'],
  ['custoPago', 'Custo Pago'],
  ['nfsLancadas', 'NFs Lançadas'],
  ['saldosOC', 'Saldos OC'],
  ['saldosContratos', 'Saldos Contratos'],
  ['custoEmSistema', 'Custo em Sistema'],
  ['comprometimentos', 'Comprometimentos e Rateios'],
  ['custoLancado', 'Custo Lançado'],
  ['saldoOrcamento', 'Saldo de Orçamento'],
  ['orcamentoTermino', 'Orçamento de Término'],
  ['custoProjetado', 'Custo Projetado Total'],
  ['resultadoProjetado', 'Resultado Projetado Obra'],
  ['iec', 'IEC Obra'],
  ['resultadoSemCorrecao', 'Resultado Sem Correção'],
  ['iecSemCorrecao', 'IEC Sem correção'],
  ['percContratado', '% Contratado'],
  ['custoPassivelReajuste', 'Custo Passível de Reajuste'],
  ['custoLancadoMes', 'Custo Lançado Mês'],
  ['custoPagoMes', 'Custo Pago Mês'],
  ['variacaoMesCusto', 'Variação Mês - Custo'],
  ['variacoesPrincipais', 'Variações principais'],
  ['variacaoDoMes', 'Variação do mês'],
  ['contingencias', 'Contingências'],
  ['custosForaContrato', 'Custos Fora Contrato'],
  ['totalAditivos', 'Total de Aditivos'],
  ['aditivosSemAprovacao', 'Aditivos sem Aprovação'],
  ['custoProjetadoSemCorrecao', 'Custo Total Projetado (sem correção)'],
];

/** Campos de texto (o resto é numérico, exceto chaves e datas tratadas à parte). */
export const CAMPOS_TEXTO = new Set([
  'obra', 'cliente', 'item', 'descricao', 'houveReplanejamento', 'comentario', 'principaisMetas',
  'consideracaoMes', 'variacoesPrincipais', 'variacaoDoMes', 'contingencias',
]);

/** Campos de data (número serial do Excel ou texto ISO). `mes` vira "AAAA-MM". */
export const CAMPOS_DATA = new Set(['mes', 'fimProjetado']);
