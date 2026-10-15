/**
 * Gestão de usuários (somente Dev). No modo Supabase os usuários são criados no Supabase Auth.
 */
import { validarSenha } from '../auth/senha.mjs';
import { enviarJson, erro, lerJson } from '../http/respostas.mjs';
import { papelValido } from '../../public/js/domain/permissoes.js';

export function registrarUsuarios(rotas, { autenticacao }) {
  rotas.adicionar('GET', '/api/usuarios', { permissao: 'administrar' }, async ({ req, res }) => {
    enviarJson(req, res, 200, await autenticacao.listar());
  });

  rotas.adicionar('POST', '/api/usuarios', { permissao: 'administrar' }, async ({ req, res }) => {
    const { nome, email, papel, senha } = await lerJson(req);
    enviarJson(req, res, 201, await autenticacao.criar({ nome, email, papel, senha }));
  });

  rotas.adicionar('PUT', '/api/usuarios/:id', { permissao: 'administrar' }, async ({ req, res, params, usuario }) => {
    const { nome, papel, ativo, senha } = await lerJson(req);
    const campos = {};
    if (nome !== undefined) campos.nome = String(nome).trim();
    if (papel !== undefined) {
      if (!papelValido(papel)) throw erro(400, 'Papel inválido.');
      campos.papel = papel;
    }
    if (ativo !== undefined) campos.ativo = Boolean(ativo);
    if (senha) {
      const problema = validarSenha(senha);
      if (problema) throw erro(400, problema);
      campos.senha = senha;
    }
    if (params.id === usuario.id && (campos.ativo === false || (campos.papel && campos.papel !== 'dev'))) {
      throw erro(400, 'Você não pode remover o seu próprio acesso de Dev.');
    }
    enviarJson(req, res, 200, await autenticacao.atualizar(params.id, campos));
  });

  rotas.adicionar('DELETE', '/api/usuarios/:id', { permissao: 'administrar' }, async ({ req, res, params, usuario }) => {
    if (params.id === usuario.id) throw erro(400, 'Você não pode excluir o próprio usuário.');
    await autenticacao.remover(params.id);
    enviarJson(req, res, 200, { ok: true });
  });
}
