/**
 * Conversões dos valores crus do Excel (vindos do Graph `usedRange(valuesOnly=true)`) para tipos do app.
 * Funções puras: rodam no navegador e nos testes (Node) sem dependências.
 */
import { CAMPOS_DATA, CAMPOS_TEXTO } from './colunas.js';

/** Dia 0 do calendário serial do Excel (1899-12-30, já compensando o bug do ano 1900). */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DIA_MS = 86_400_000;

/** Remove acentos, baixa a caixa e junta espaços — usado para comparar nomes. */
export function semAcento(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cabeçalho comparável: "Replanejado Atual  Acumulado - Obra " ≡ "replanejado atual acumulado - obra". */
export const normalizarCabecalho = semAcento;

/**
 * Chave estável de uma obra. As abas grafam o nome de jeitos diferentes
 * ("MetroCasa Estação Vila Prudente" × "Metrocasa Estação Vila Prudente"), e o BD_Econômico não traz o
 * Nº da obra UAU — por isso a junção entre abas é pelo nome normalizado.
 */
export const chaveObra = semAcento;

/** Número ou `null`. Aceita número, texto pt-BR ("10119,56"), vazio, "-" e "…". */
export function numero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (texto === '' || texto === '-' || texto === '...' || texto === '…') return null;
  const limpo = texto.replace(/[R$\s%]/g, '');
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Texto ou `null`. Na planilha, "0" em campo de comentário significa "sem comentário". */
export function texto(valor) {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  return t === '' || t === '0' || t === '-' ? null : t;
}

/** Data ISO "AAAA-MM-DD" a partir de serial do Excel, Date ou texto ISO/pt-BR. */
export function dataIso(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor <= 0) return null;
    return new Date(EXCEL_EPOCH_UTC + Math.round(valor) * DIA_MS).toISOString().slice(0, 10);
  }
  const t = String(valor).trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const serial = numero(t);
  return serial ? dataIso(serial) : null;
}

/**
 * Mês "AAAA-MM". Datas de fim de mês (ex.: 31/05/2025) continuam no próprio mês: na planilha elas
 * aparecem como o mês anterior ao 01/06/2025 seguinte, não como duplicata.
 */
export function mesDe(valor) {
  const iso = dataIso(valor);
  return iso ? iso.slice(0, 7) : null;
}

/** Soma `n` meses a "AAAA-MM" (n pode ser negativo). */
export function somarMeses(mes, n) {
  const [ano, m] = mes.split('-').map(Number);
  const total = ano * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Lista de meses de `de` até `ate`, inclusive. */
export function intervaloMeses(de, ate) {
  const meses = [];
  for (let m = de; m <= ate; m = somarMeses(m, 1)) meses.push(m);
  return meses;
}

/**
 * Converte a matriz do Graph (primeira linha = cabeçalhos) em objetos com nomes lógicos.
 * @param {{colunas: string[], linhas: unknown[][]}} matriz
 * @param {Array<[string, string, string?]>} campos  definição de colunas.js
 * @param {'obra'|'cliente'} visao
 */
export function linhasParaObjetos(matriz, campos, visao = 'obra') {
  const indice = new Map();
  matriz.colunas.forEach((nome, i) => {
    const chave = normalizarCabecalho(nome);
    if (!indice.has(chave)) indice.set(chave, i); // primeira ocorrência vence (há colunas repetidas)
  });
  const mapa = campos.map(([logico, colunaObra, colunaCliente]) => {
    const coluna = visao === 'cliente' && colunaCliente ? colunaCliente : colunaObra;
    return [logico, indice.get(normalizarCabecalho(coluna))];
  });
  return matriz.linhas.map((linha) => {
    const obj = {};
    for (const [logico, i] of mapa) obj[logico] = converter(logico, i === undefined ? null : linha[i]);
    return obj;
  });
}

function converter(logico, valor) {
  if (logico === 'mes') return mesDe(valor);
  if (CAMPOS_DATA.has(logico)) return dataIso(valor);
  if (logico === 'uau') return texto(valor);
  if (logico === 'item') return valor === null || valor === undefined ? null : String(valor).trim() || null;
  if (CAMPOS_TEXTO.has(logico)) return texto(valor);
  return numero(valor);
}
