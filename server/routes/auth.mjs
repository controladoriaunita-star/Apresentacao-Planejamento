/**
 * Rotas de autenticação: login, logout, sessão, primeiro acesso e troca da própria senha.
 * A regra fica no provedor (autenticacao.mjs): local ou Supabase Auth.
 */
import { validarSenha } from '../auth/senha.mjs';
import { usuarioPublico } from '../auth/autenticacao.mjs';
import { enviarJson, erro, lerJson } from '../http/respostas.mjs';

const TENTATIVAS_POR_MINUTO = 8;

export function registrarAuth(rotas, { autenticacao }) {
  const tentativas = new Map(); // ip → [timestamps] (limite simples contra força bruta)

  rotas.adicionar('GET', '/api/auth/sessao', { permissao: null }, async ({ req, res, usuario }) => {
    enviarJson(req, res, 200, { usuario: usuario ? usuarioPublico(usuario) : null, precisaConfigurar: await autenticacao.precisaConfigurar() });
  });

  rotas.adicionar('POST', '/api/auth/login', { permissao: null }, async ({ req, res }) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? '?';
    const recentes = (tentativas.get(ip) ?? []).filter((t) => Date.now() - t < 60_000);
    if (recentes.length >= TENTATIVAS_POR_MINUTO) throw erro(429, 'Muitas tentativas. Aguarde um minuto.');
    const { email, senha } = await lerJson(req);
    const resultado = await autenticacao.entrar(email, senha);
    if (!resultado) {
      tentativas.set(ip, [...recentes, Date.now()]);
      throw erro(401, 'E-mail ou senha incorretos.');
    }
    tentativas.delete(ip);
    enviarJson(req, res, 200, { usuario: usuarioPublico(resultado.usuario) }, { 'set-cookie': resultado.cookie });
  });

  rotas.adicionar('POST', '/api/auth/logout', { permissao: null }, async ({ req, res }) => {
    enviarJson(req, res, 200, { ok: true }, { 'set-cookie': await autenticacao.sair(req) });
  });

  /** Primeiro acesso: só funciona enquanto não existe nenhum usuário; cria o primeiro Dev. */
  rotas.adicionar('POST', '/api/auth/configurar', { permissao: null }, async ({ req, res }) => {
    const resultado = await autenticacao.configurar(await lerJson(req));
    enviarJson(req, res, 201, { usuario: usuarioPublico(resultado.usuario) }, { 'set-cookie': resultado.cookie });
  });

  rotas.adicionar('PUT', '/api/auth/senha', { permissao: 'ver' }, async ({ req, res, usuario }) => {
    const { senhaAtual, novaSenha } = await lerJson(req);
    const problema = validarSenha(novaSenha);
    if (problema) throw erro(400, problema);
    await autenticacao.trocarSenha(usuario, senhaAtual, novaSenha);
    enviarJson(req, res, 200, { ok: true });
  });
}
