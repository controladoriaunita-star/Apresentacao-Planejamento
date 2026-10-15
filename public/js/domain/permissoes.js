/**
 * Papéis e capacidades — fonte única usada pelo servidor (bloqueio) e pelo front (o que mostrar).
 *
 * - dev: visão de todo o projeto (inclui usuários e diagnóstico das fontes);
 * - planejamento: cadastra fotos, TxC, arquivos, telas da apresentação Cliente e o cadastro das obras;
 * - viewer: só visualiza as abas das apresentações.
 */
export const PAPEIS = Object.freeze({
  dev: { nome: 'Dev', descricao: 'Acesso total, inclusive usuários e diagnóstico' },
  planejamento: { nome: 'Planejamento', descricao: 'Cadastra fotos, TxC, arquivos e telas do cliente' },
  viewer: { nome: 'Viewer', descricao: 'Somente visualiza as apresentações' },
});

export const CAPACIDADES = Object.freeze({
  ver: 'ver', // abrir as apresentações
  editarConteudo: 'editarConteudo', // fotos, TxC, telas do cliente, cadastro de obras, atualizar dados
  administrar: 'administrar', // usuários, diagnóstico
});

const MATRIZ = {
  dev: [CAPACIDADES.ver, CAPACIDADES.editarConteudo, CAPACIDADES.administrar],
  planejamento: [CAPACIDADES.ver, CAPACIDADES.editarConteudo],
  viewer: [CAPACIDADES.ver],
};

export function pode(papel, capacidade) {
  return Boolean(MATRIZ[papel]?.includes(capacidade));
}

export const papelValido = (papel) => Object.hasOwn(PAPEIS, papel);
