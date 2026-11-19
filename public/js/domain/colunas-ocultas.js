/**
 * v34 — Colunas do Resumo Físico e do Resumo Econômico que o Dev oculta na apresentação Cliente (tela e PDF).
 * Na Obra aparecem sempre todas. A lista vale para todas as obras.
 * Módulo puro: usado pelo front (tabelas e editor) e pelo servidor (validação).
 */
import { COLUNAS_FISICO } from './nomes-colunas.js';
import { COLUNAS_ECONOMICO } from './resumo-economico.js';

/** Grupos do Econômico já ocultos no Cliente por regra fixa (v28) — não entram na escolha do Dev. */
export const GRUPOS_ECONOMICO_FIXOS_CLIENTE = Object.freeze(new Set(['Sem correção']));

/** Tudo o que o Dev pode ocultar: { chave, tabela ('fisico' | 'economico'), titulo, contexto }. */
export const OCULTAVEIS = Object.freeze([
  ...COLUNAS_FISICO.map((c) => ({ chave: `fisico.${c.id}`, tabela: 'fisico', titulo: c.titulo, contexto: c.contexto })),
  ...COLUNAS_ECONOMICO.filter((c) => !GRUPOS_ECONOMICO_FIXOS_CLIENTE.has(c.grupo))
    .map((c) => ({ chave: `economico.${c.campo}`, tabela: 'economico', titulo: c.titulo, contexto: c.grupo })),
].map(Object.freeze));

const CHAVES = new Set(OCULTAVEIS.map((o) => o.chave));

/**
 * Só chaves conhecidas, sem repetição, na ordem das tabelas. Cada tabela mantém ao menos uma coluna visível:
 * se a entrada ocultar todas, as daquela tabela são descartadas.
 */
export function normalizarOcultas(entrada) {
  const pedidas = new Set(Array.isArray(entrada) ? entrada.filter((c) => typeof c === 'string' && CHAVES.has(c)) : []);
  return ['fisico', 'economico'].flatMap((tabela) => {
    const daTabela = OCULTAVEIS.filter((o) => o.tabela === tabela).map((o) => o.chave);
    const ocultas = daTabela.filter((c) => pedidas.has(c));
    return ocultas.length < daTabela.length ? ocultas : [];
  });
}

/** A coluna fica oculta? Só na apresentação Cliente. */
export const colunaOculta = (ocultas, visao, chave) => visao === 'cliente' && Boolean(ocultas?.includes(chave));
