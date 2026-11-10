/**
 * Layout do Resumo Geral: cada quadro ocupa um retângulo numa grade de 24 × 24 células que cobre a tela
 * inteira. O Dev move e redimensiona os quadros (Resumo Geral → "Editar layout") e o layout salvo vale para
 * todas as apresentações. Módulo puro: usado pelo front (desenho e edição) e pelo servidor (validação).
 */
export const GRADE = Object.freeze({ colunas: 24, linhas: 24 });

/** Tamanho mínimo de um quadro, em células. */
export const MINIMO = Object.freeze({ w: 3, h: 3 });

/** Quadros do Resumo Geral, na ordem de leitura (também a ordem em telas pequenas, sem a grade). */
export const QUADROS = Object.freeze([
  { id: 'cef', nome: 'CEF × Físico' },
  { id: 'economica', nome: 'Análise econômica' },
  { id: 'curva', nome: 'Curva acumulada' },
  { id: 'barras', nome: 'Realizado × planejado (mês)' },
  { id: 'assertividade', nome: 'Assertividade' },
  { id: 'custos', nome: 'Custos por' },
  { id: 'incc', nome: 'INCC' },
  { id: 'nhnu', nome: 'NH-NU' },
  { id: 'andamento', nome: 'Andamento geral' },
]);

/**
 * Layout padrão: CEF × Físico e análise econômica à esquerda, até o pé da tela; três gráficos e o rodapé
 * (custos, INCC, NH-NU e velocímetro) à direita. {x, y} = coluna/linha inicial (1…24); {w, h} = largura/altura.
 */
export const LAYOUT_PADRAO = Object.freeze({
  cef: { x: 1, y: 1, w: 6, h: 11 },
  economica: { x: 1, y: 12, w: 6, h: 13 },
  curva: { x: 7, y: 1, w: 18, h: 6 },
  barras: { x: 7, y: 7, w: 18, h: 6 },
  assertividade: { x: 7, y: 13, w: 18, h: 6 },
  custos: { x: 7, y: 19, w: 7, h: 6 },
  incc: { x: 14, y: 19, w: 4, h: 6 },
  nhnu: { x: 18, y: 19, w: 3, h: 6 },
  andamento: { x: 21, y: 19, w: 4, h: 6 },
});

const inteiro = (v, padrao) => (Number.isInteger(v) ? v : padrao);
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Retângulo válido dentro da grade (largura/altura mínimas, sem sair pelas bordas). */
export function ajustarRetangulo(r, padrao) {
  const w = limitar(inteiro(r?.w, padrao.w), MINIMO.w, GRADE.colunas);
  const h = limitar(inteiro(r?.h, padrao.h), MINIMO.h, GRADE.linhas);
  return {
    x: limitar(inteiro(r?.x, padrao.x), 1, GRADE.colunas - w + 1),
    y: limitar(inteiro(r?.y, padrao.y), 1, GRADE.linhas - h + 1),
    w,
    h,
  };
}

export const sobrepoe = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Pares de quadros que se sobrepõem (lista vazia = layout válido). */
export function sobreposicoes(layout) {
  const pares = [];
  QUADROS.forEach((a, i) => QUADROS.slice(i + 1).forEach((b) => {
    if (sobrepoe(layout[a.id], layout[b.id])) pares.push([a.id, b.id]);
  }));
  return pares;
}

/**
 * Layout completo e dentro da grade: quadros faltando voltam ao padrão, valores inválidos são ajustados e
 * chaves desconhecidas são descartadas. Com quadros sobrepostos, `estrito` lança erro; senão volta ao padrão.
 */
export function normalizarLayout(entrada, { estrito = false } = {}) {
  const layout = Object.fromEntries(QUADROS.map(({ id }) => [id, ajustarRetangulo(entrada?.[id], LAYOUT_PADRAO[id])]));
  const pares = sobreposicoes(layout);
  if (!pares.length) return layout;
  if (estrito) {
    const nome = (id) => QUADROS.find((q) => q.id === id).nome;
    throw new Error(`Quadros sobrepostos: ${pares.map(([a, b]) => `${nome(a)} e ${nome(b)}`).join('; ')}.`);
  }
  return normalizarLayout(LAYOUT_PADRAO);
}
