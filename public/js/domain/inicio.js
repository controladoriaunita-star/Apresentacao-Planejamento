/**
 * Aba "Início" — indicadores da empresa no mês de referência.
 */
import { infoDoMes } from './base.js';
import { somar } from './agregar.js';
import { ultimoMesFechado } from './periodo.js';
import { somarMeses } from './normalizar.js';

/** Uma obra sem fechamento há mais que isto (em meses) deixa de contar como ativa. */
const MESES_SEM_FECHAMENTO_TOLERADOS = 3;
const CONCLUIDA = 0.9999;

/**
 * Obra ativa no mês: começou (tem realizado), não chegou a 100% e fechou mês recentemente.
 * O cadastro pode forçar a situação (`situacao: 'ativa' | 'concluida' | 'paralisada'`).
 */
export function obraAtiva(base, chave, referencia) {
  const situacao = base.cadastro.get(chave)?.situacao;
  if (situacao === 'ativa') return true;
  if (situacao === 'concluida' || situacao === 'paralisada') return false;
  const ultimo = ultimoMesFechado(base, chave, referencia);
  if (!ultimo || ultimo < somarMeses(referencia, -MESES_SEM_FECHAMENTO_TOLERADOS)) return false;
  const acumulado = infoDoMes(base, chave, ultimo)?.realizadoAcm ?? 0;
  return acumulado < CONCLUIDA;
}

/**
 * @returns {{
 *   ativas: Array<{chave: string, nome: string, assertividade: number|null, fechouNoMes: boolean, unidadesMes: number|null}>,
 *   assertividadeMedia: number|null, obrasComFechamento: number, unidadesMes: number|null,
 *   melhor: {nome: string, assertividade: number}|null
 * }}
 */
export function calcularInicio(base, referencia) {
  const ativas = base.obras
    .filter((obra) => obraAtiva(base, obra.chave, referencia))
    .map((obra) => {
      const info = infoDoMes(base, obra.chave, referencia);
      const fechouNoMes = (info?.realizadoMes ?? 0) > 0;
      const uh = base.cadastro.get(obra.chave)?.numeroUH;
      return {
        chave: obra.chave,
        nome: obra.nome,
        cliente: obra.cliente,
        assertividade: fechouNoMes ? info?.assertividade ?? null : null,
        realizadoAcm: info?.realizadoAcm ?? null,
        fechouNoMes,
        // Unidades construídas no mês = Nº de UH × avanço físico do mês.
        unidadesMes: typeof uh === 'number' && fechouNoMes ? uh * info.realizadoMes : null,
      };
    });

  // Assertividade média da empresa: média simples entre as obras que fecharam o mês
  // (o Power BI dividia pelo total de obras, contando as sem fechamento como zero).
  const comFechamento = ativas.filter((o) => typeof o.assertividade === 'number');
  const media = comFechamento.length
    ? comFechamento.reduce((s, o) => s + o.assertividade, 0) / comFechamento.length
    : null;
  const melhor = comFechamento.reduce((m, o) => (!m || o.assertividade > m.assertividade ? o : m), null);

  return {
    referencia,
    ativas,
    assertividadeMedia: media,
    obrasComFechamento: comFechamento.length,
    unidadesMes: somar(ativas.map((o) => o.unidadesMes)),
    obrasSemCadastroUH: ativas.filter((o) => o.fechouNoMes && o.unidadesMes === null).map((o) => o.nome),
    melhor: melhor ? { nome: melhor.nome, cliente: melhor.cliente, assertividade: melhor.assertividade } : null,
  };
}
