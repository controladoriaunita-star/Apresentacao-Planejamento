/**
 * Base de dados em memória da apresentação: junta as abas do SharePoint, o cadastro de obras e o INCC
 * em índices por obra → mês → item. É a "camada de modelo" que substitui o modelo do Power BI.
 */
import {
  ABAS, CAMPOS_ECONOMICO, CAMPOS_FISICO_ATIVIDADE, CAMPOS_INFOS_GERAIS, CAMPOS_ORCAMENTO, ITEM_GERAL,
} from './colunas.js';
import { chaveObra, linhasParaObjetos, numero } from './normalizar.js';

const MATRIZ_VAZIA = { colunas: [], linhas: [] };

/**
 * @param {object} bruto  resposta de GET /api/dados/resumo
 * @param {'obra'|'cliente'} visao
 */
export function criarBase(bruto, visao = 'obra') {
  const abas = bruto?.abas ?? {};
  const infos = linhasParaObjetos(abas[ABAS.infosGerais] ?? MATRIZ_VAZIA, CAMPOS_INFOS_GERAIS, visao)
    .filter((l) => l.obra && l.mes && (l.item ?? ITEM_GERAL) === ITEM_GERAL);
  const orcamento = linhasParaObjetos(abas[ABAS.orcamento] ?? MATRIZ_VAZIA, CAMPOS_ORCAMENTO, visao)
    .filter((l) => l.obra && l.item);
  const economico = linhasParaObjetos(abas[ABAS.economico] ?? MATRIZ_VAZIA, CAMPOS_ECONOMICO, visao)
    .filter((l) => l.obra && l.mes && l.item)
    // IEC 0 é "sem IEC": a consulta do Power BI trocava "-" por 0. Um IEC real nunca é zero.
    .map((l) => ({ ...l, iec: l.iec || null, iecSemCorrecao: l.iecSemCorrecao || null }));

  const obras = new Map();
  const registrarObra = (linha) => {
    const chave = chaveObra(linha.obra);
    const atual = obras.get(chave) ?? { chave, nome: linha.obra, cliente: null, uau: null };
    atual.cliente ??= linha.cliente ?? null;
    atual.uau ??= linha.uau ?? null;
    obras.set(chave, atual);
    return chave;
  };

  const infosPorObra = new Map(); // chave → Map(mes → linha)
  for (const linha of infos) {
    const chave = registrarObra(linha);
    const porMes = garantirMapa(infosPorObra, chave);
    if (!porMes.has(linha.mes)) porMes.set(linha.mes, linha); // linha duplicada: a primeira vence
  }

  const orcamentoPorObra = new Map(); // chave → Map(item → {descricao, orcamento})
  for (const linha of orcamento) {
    const chave = registrarObra(linha);
    const porItem = garantirMapa(orcamentoPorObra, chave);
    if (!porItem.has(linha.item)) porItem.set(linha.item, { descricao: linha.descricao, orcamento: linha.orcamento });
  }

  const economicoPorObra = new Map(); // chave → Map(mes → Map(item → linha))
  for (const linha of economico) {
    const chave = chaveObra(linha.obra);
    if (!obras.has(chave)) registrarObra(linha);
    const porItem = garantirMapa(garantirMapa(economicoPorObra, chave), linha.mes);
    if (!porItem.has(linha.item)) porItem.set(linha.item, linha);
  }

  const cadastro = new Map((bruto?.cadastro ?? []).map((c) => [chaveObra(c.obra ?? c.nome), c]));
  // Obras cadastradas no app que ainda não aparecem nas planilhas também entram na lista.
  for (const [chave, c] of cadastro) {
    if (!obras.has(chave) && (c.obra ?? c.nome)) obras.set(chave, { chave, nome: c.obra ?? c.nome, cliente: c.cliente ?? null, uau: c.uau ?? null });
  }

  const incc = new Map((bruto?.incc ?? []).map((i) => [i.mes, numero(i.indice)]));

  return {
    visao,
    atualizadoEm: bruto?.atualizadoEm ?? null,
    obras: [...obras.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    infos: infosPorObra,
    orcamento: orcamentoPorObra,
    economico: economicoPorObra,
    cadastro,
    incc,
  };
}

/** Linhas do BD_Físico por atividade de uma obra (carregadas sob demanda), indexadas por item → mês. */
export function criarFisicoAtividade(matriz, visao = 'obra') {
  const porItem = new Map();
  for (const linha of linhasParaObjetos(matriz ?? MATRIZ_VAZIA, CAMPOS_FISICO_ATIVIDADE, visao)) {
    if (!linha.item || !linha.mes) continue;
    const porMes = garantirMapa(porItem, linha.item);
    const existente = porMes.get(linha.mes);
    porMes.set(linha.mes, existente ? mesclarMaximo(existente, linha) : linha);
  }
  return porItem;
}

/** Linha de BD_Infos Gerais da obra no mês (ou null). */
export function infoDoMes(base, chave, mes) {
  return base.infos.get(chave)?.get(mes) ?? null;
}

/** Linha do BD_Econômico da obra no mês para o item (padrão: Geral). */
export function economicoDoMes(base, chave, mes, item = ITEM_GERAL) {
  return base.economico.get(chave)?.get(mes)?.get(item) ?? null;
}

/** Orçamento base físico total da obra (BD_Orc, ITEM = Geral) — medida "Orçamento Geral" do Power BI. */
export function orcamentoGeral(base, chave) {
  return base.orcamento.get(chave)?.get(ITEM_GERAL)?.orcamento ?? null;
}

/** Todos os meses presentes em BD_Infos Gerais para as obras informadas, em ordem. */
export function mesesDasObras(base, chaves) {
  const meses = new Set();
  for (const chave of chaves) for (const mes of base.infos.get(chave)?.keys() ?? []) meses.add(mes);
  return [...meses].sort();
}

/** Índice INCC do mês; se faltar, usa o último índice publicado antes dele. */
export function inccDoMes(base, mes) {
  if (!mes) return null;
  if (base.incc.has(mes)) return { mes, indice: base.incc.get(mes) };
  const anteriores = [...base.incc.keys()].filter((m) => m <= mes).sort();
  const ultimo = anteriores.at(-1);
  return ultimo ? { mes: ultimo, indice: base.incc.get(ultimo) } : null;
}

function garantirMapa(mapa, chave) {
  let valor = mapa.get(chave);
  if (!valor) mapa.set(chave, (valor = new Map()));
  return valor;
}

/** Duplicatas na planilha (mesmo item e mês): o Power BI usava MAX; aqui também. */
function mesclarMaximo(a, b) {
  const resultado = { ...a };
  for (const [campo, valor] of Object.entries(b)) {
    if (typeof valor === 'number' && (typeof a[campo] !== 'number' || valor > a[campo])) resultado[campo] = valor;
    else if (resultado[campo] === null || resultado[campo] === undefined) resultado[campo] = valor;
  }
  return resultado;
}
