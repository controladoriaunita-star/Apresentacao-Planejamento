/**
 * Papéis e capacidades — fonte única usada pelo servidor (bloqueio) e pelo front (o que mostrar).
 *
 * - dev: visão de todo o projeto (inclui usuários e diagnóstico das fontes);
 * - planejamento: cadastra fotos, TxC, arquivos, telas da apresentação Cliente e o cadastro das obras;
 * - seguranca: só a Administração → Segurança do Trabalho (acidentes) e o Dashboard Segurança;
 * - viewer: só visualiza as abas das apresentações.
 */
export const PAPEIS = Object.freeze({
  dev: { nome: 'Dev', descricao: 'Acesso total, inclusive usuários e diagnóstico' },
  planejamento: { nome: 'Planejamento', descricao: 'Cadastra fotos, TxC, arquivos e telas do cliente' },
  seguranca: { nome: 'Segurança', descricao: 'Somente os dados e o dashboard de Segurança do Trabalho' },
  viewer: { nome: 'Viewer', descricao: 'Somente visualiza as apresentações' },
});

export const CAPACIDADES = Object.freeze({
  conta: 'conta', // minha conta (trocar a própria senha) — todo usuário logado
  ver: 'ver', // abrir as apresentações
  verSeguranca: 'verSeguranca', // ler acidentes e indicadores (aba da apresentação e Administração → Segurança)
  editarSeguranca: 'editarSeguranca', // Administração → Segurança do Trabalho e Dashboard Segurança
  editarConteudo: 'editarConteudo', // fotos, TxC, telas do cliente, cadastro de obras, atualizar dados
  exportarPdf: 'exportarPdf', // "Exportar PDF" da apresentação Cliente (material enviado ao cliente)
  administrar: 'administrar', // usuários, diagnóstico
});

const C = CAPACIDADES;
const MATRIZ = {
  dev: [C.conta, C.ver, C.verSeguranca, C.editarSeguranca, C.editarConteudo, C.exportarPdf, C.administrar],
  planejamento: [C.conta, C.ver, C.verSeguranca, C.editarSeguranca, C.editarConteudo, C.exportarPdf],
  seguranca: [C.conta, C.verSeguranca, C.editarSeguranca],
  viewer: [C.conta, C.ver, C.verSeguranca],
};

export function pode(papel, capacidade) {
  return Boolean(MATRIZ[papel]?.includes(capacidade));
}

export const papelValido = (papel) => Object.hasOwn(PAPEIS, papel);
