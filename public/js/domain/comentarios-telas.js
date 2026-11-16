/**
 * v29 — Comentários por tela: anotações do Dev gravadas por obra + mês + tela (ex.: o que foi pontuado na
 * reunião), para consulta depois. Só a equipe interna (Dev e Planejamento) vê; não aparecem para o Viewer
 * nem no PDF. Ficam no armazém de documentos, um documento por obra e mês.
 * Módulo puro: usado pelo front e pelo servidor (validação).
 */

export const MAX_TEXTO = 2000;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const TELA = /^[\w-]{1,80}$/;

/** Nome do documento no armazém (só letras, números, _ e -: a chave da obra é normalizada). */
export const documentoComentarios = (chaveObra, mes) => `comentarios-telas/${String(chaveObra).replace(/[^\w-]+/g, '_')}/${mes}`;

/**
 * Valida o comentário novo. Devolve { obra, mes, tela, visao, texto } ou lança Error com a mensagem para o usuário.
 */
export function validarComentario({ obra, mes, tela, visao, texto } = {}) {
  if (typeof obra !== 'string' || !obra.trim()) throw new Error('Informe a obra.');
  if (!MES.test(String(mes ?? ''))) throw new Error('Informe o mês (AAAA-MM).');
  if (!TELA.test(String(tela ?? ''))) throw new Error('Informe a tela.');
  const limpo = String(texto ?? '').trim();
  if (!limpo) throw new Error('Escreva o comentário.');
  if (limpo.length > MAX_TEXTO) throw new Error(`Comentário maior que ${MAX_TEXTO} caracteres.`);
  return { obra: obra.trim(), mes, tela, visao: visao === 'cliente' ? 'cliente' : 'obra', texto: limpo };
}

export const mesValido = (mes) => MES.test(String(mes ?? ''));

/** Comentários de uma tela, do mais recente para o mais antigo. */
export const comentariosDaTela = (lista, tela) => (lista ?? []).filter((c) => c.tela === tela).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
