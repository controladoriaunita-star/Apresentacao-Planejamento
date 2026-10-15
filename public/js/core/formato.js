/**
 * Formatos pt-BR do padrão Unità: moeda BRL, percentual com 2 casas (1 em grades densas),
 * variação com sinal, mês "MMM/AA" em caixa alta e travessão para vazio.
 */
export const VAZIO = '—';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaCompacta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const ok = (v) => typeof v === 'number' && Number.isFinite(v);

export const fmtMoeda = (v) => (ok(v) ? moeda.format(v) : VAZIO);
export const fmtMoedaCompacta = (v) => (ok(v) ? moedaCompacta.format(v) : VAZIO);

export function fmtPercentual(v, casas = 2) {
  return ok(v) ? `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%` : VAZIO;
}

/** Variação com sinal explícito (+3,20% / -1,50%). */
export function fmtVariacao(v, casas = 2) {
  if (!ok(v)) return VAZIO;
  const texto = fmtPercentual(Math.abs(v), casas);
  return v > 0 ? `+${texto}` : v < 0 ? `-${texto}` : texto;
}

export function fmtNumero(v, casas = 0) {
  return ok(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : VAZIO;
}

export const fmtIndice = (v) => fmtNumero(v, 4);

/** "2026-09" → "SET/26" */
export function fmtMes(mes) {
  if (!mes) return VAZIO;
  const [a, m] = mes.split('-');
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
}

/** "2026-09" → "setembro de 2026" */
export function fmtMesLongo(mes) {
  if (!mes) return VAZIO;
  const [a, m] = mes.split('-');
  return `${MESES_LONGOS[Number(m) - 1]} de ${a}`;
}

/** "2026-09-15" → "15/09/2026" (sem fuso) */
export function fmtData(iso) {
  if (!iso) return VAZIO;
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function fmtDataHora(iso) {
  if (!iso) return VAZIO;
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Formata conforme o tipo declarado nas colunas ('moeda' | 'percentual' | 'indice' | 'numero'). */
export function fmtPorTipo(valor, tipo) {
  if (tipo === 'moeda') return fmtMoeda(valor);
  if (tipo === 'percentual') return fmtPercentual(valor, 1);
  if (tipo === 'indice') return fmtNumero(valor, 3);
  return fmtNumero(valor);
}

/** Classe de cor para valores com sinal (desvios, resultados). */
export const classeSinal = (v) => (!ok(v) || v === 0 ? '' : v > 0 ? 'positivo' : 'negativo');
