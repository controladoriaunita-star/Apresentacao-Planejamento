/**
 * v29 — Nomes das colunas do Resumo Físico e do Resumo Econômico definidos pelo Dev (Obra, Cliente e PDF).
 * Cada coluna/grupo renomeável tem uma chave estável; o que não foi renomeado usa o nome original.
 * Os grupos com o mês (ex.: "MAR/26") não são renomeáveis: mudam a cada competência.
 * Módulo puro: usado pelo front (títulos e editor) e pelo servidor (validação).
 */
import { COLUNAS_ECONOMICO } from './resumo-economico.js';

/** Tamanho máximo de um nome. */
export const MAX_NOME = 60;

/** Colunas do Resumo Físico, na ordem da tabela (o título original vem daqui). */
export const COLUNAS_FISICO = Object.freeze([
  { id: 'orcamento', titulo: 'Orçamento (R$)', contexto: 'Projeção econômica' },
  { id: 'orcamentoProjetado', titulo: 'Orç. projetado (R$)', contexto: 'Projeção econômica' },
  { id: 'iec', titulo: 'IEC', contexto: 'Projeção econômica' },
  { id: 'realizadoAcm', titulo: 'Realizado acm', contexto: 'Mês de referência' },
  { id: 'realizadoMes', titulo: 'Realizado mês', contexto: 'Mês de referência' },
  { id: 'planejadoInicial', titulo: 'Planejado inicial', contexto: 'Mês de referência' },
  { id: 'planejadoAcm', titulo: 'Planejado acm', contexto: 'Mês de referência' },
  { id: 'planejadoMes', titulo: 'Planejado mês', contexto: 'Mês de referência' },
  { id: 'acerto', titulo: '% acerto', contexto: 'Mês de referência' },
  { id: 'cronograma', titulo: 'Cronograma', contexto: 'Mês de referência' },
  { id: 'adiantamento', titulo: 'Adiant.', contexto: 'Mês de referência' },
  { id: 'proximoPlanejadoMes', titulo: 'Planejado mês', contexto: 'Mês seguinte' },
  { id: 'proximoPlanejadoAcm', titulo: 'Planejado acm', contexto: 'Mês seguinte' },
  { id: 'proximoPrevisto', titulo: 'Previsto', contexto: 'Mês seguinte' },
  { id: 'proximoAdiantamento', titulo: 'Adiant.', contexto: 'Mês seguinte' },
  { id: 'pesoAtraso', titulo: 'Peso atraso', contexto: 'Pesos' },
  { id: 'pesoPlanejado', titulo: 'Peso planejado', contexto: 'Pesos' },
]);

/** Grupos (faixa de cima do cabeçalho) renomeáveis do Resumo Físico. */
export const GRUPOS_FISICO = Object.freeze([
  { id: 'projecao', titulo: 'Projeção econômica' },
  { id: 'pesos', titulo: 'Pesos' },
]);

const gruposEconomico = [...new Set(COLUNAS_ECONOMICO.map((c) => c.grupo))];

/**
 * Tudo o que o Dev pode renomear: { chave, tabela ('fisico' | 'economico'), tipo ('coluna' | 'grupo'), original, contexto }.
 * No Econômico a unidade "(R$)" é acrescentada automaticamente ao nome das colunas em reais.
 */
export const RENOMEAVEIS = Object.freeze([
  ...GRUPOS_FISICO.map((g) => ({ chave: `fisico.grupo.${g.id}`, tabela: 'fisico', tipo: 'grupo', original: g.titulo, contexto: 'Grupo' })),
  ...COLUNAS_FISICO.map((c) => ({ chave: `fisico.coluna.${c.id}`, tabela: 'fisico', tipo: 'coluna', original: c.titulo, contexto: c.contexto })),
  ...gruposEconomico.map((g) => ({ chave: `economico.grupo.${g}`, tabela: 'economico', tipo: 'grupo', original: g, contexto: 'Grupo' })),
  ...COLUNAS_ECONOMICO.map((c) => ({ chave: `economico.coluna.${c.campo}`, tabela: 'economico', tipo: 'coluna', original: c.titulo, contexto: c.grupo })),
].map(Object.freeze));

const ORIGINAIS = new Map(RENOMEAVEIS.map((r) => [r.chave, r.original]));

/** Só chaves conhecidas, com nome não vazio, sem quebra de linha, até MAX_NOME e diferente do original. */
export function normalizarNomes(entrada) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return {};
  const saida = {};
  for (const [chave, valor] of Object.entries(entrada)) {
    if (!ORIGINAIS.has(chave) || typeof valor !== 'string') continue;
    const nome = valor.replace(/\s+/g, ' ').trim().slice(0, MAX_NOME);
    if (nome && nome !== ORIGINAIS.get(chave)) saida[chave] = nome;
  }
  return saida;
}

/** Nome a exibir: o definido pelo Dev ou o original. */
export const nomeColuna = (nomes, chave, original) => nomes?.[chave] ?? original;
