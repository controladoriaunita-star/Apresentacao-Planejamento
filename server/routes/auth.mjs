/**
 * Rotas de autenticação: login, logout, sessão, primeiro acesso, troca da própria senha e o link por e-mail
 * (convite / "esqueci minha senha", só no Supabase). A regra fica no provedor (autenticacao.mjs).
 */
import { validarSenha } from '../auth/senha.mjs';
import { usuarioPublico } from '../auth/autenticacao.mjs';
import { enviarJson, erro, lerJson } from '../http/respostas.mjs';

const TENTATIVAS_POR_MINUTO = 8;

/**
 * Endereço do app para onde o link do e-mail volta: o domínio que recebeu a requisição (na Vercel, o host é
 * definido pela própria Vercel; o Origin não entra porque qualquer cliente o forja). O Supabase ainda confere o
 * endereço contra as Redirect URLs dele.
 */
export function enderecoDoApp(req) {
  const protocolo = req.headers['x-forwarded-proto']?.split(',')[0] ?? 'http';
  return `${protocolo}://${req.headers['x-forwarded-host'] ?? req.headers.host}/`;
}

export function registrarAuth(rotas, { autenticacao }) {
  const tentativas = new Map(); // ip → [timestamps] (limite simples contra força bruta)
  const ipDe = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? '?';
  const conferirLimite = (ip) => {
    const recentes = (tentativas.get(ip) ?? []).filter((t) => Date.now() - t < 60_000);
    if (recentes.length >= TENTATIVAS_POR_MINUTO) throw erro(429, 'Muitas tentativas. Aguarde um minuto.');
    return recentes;
  };

  rotas.adicionar('GET', '/api/auth/sessao', { permissao: null }, async ({ req, res, usuario }) => {
    enviarJson(req, res, 200, {
      usuario: usuario ? usuarioPublico(usuario) : null,
      precisaConfigurar: await autenticacao.precisaConfigurar(),
      convite: autenticacao.porConvite,
    });
  });

  rotas.adicionar('POST', '/api/auth/login', { permissao: null }, async ({ req, res }) => {
    const ip = ipDe(req);
    const recentes = conferirLimite(ip);
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

  /** "Esqueci minha senha": responde igual exista ou não o e-mail; cada pedido conta no limite por IP. */
  rotas.adicionar('POST', '/api/auth/recuperar', { permissao: null }, async ({ req, res }) => {
    const ip = ipDe(req);
    tentativas.set(ip, [...conferirLimite(ip), Date.now()]);
    const { email } = await lerJson(req);
    await autenticacao.recuperarSenha(email, enderecoDoApp(req));
    enviarJson(req, res, 200, { ok: true });
  });

  /** Volta do link do e-mail: `token` veio no endereço; grava a senha e já entra. */
  rotas.adicionar('POST', '/api/auth/definir-senha', { permissao: null }, async ({ req, res }) => {
    const ip = ipDe(req);
    const recentes = conferirLimite(ip);
    const { token, senha } = await lerJson(req);
    try {
      const resultado = await autenticacao.definirSenha(token, senha);
      enviarJson(req, res, 200, { usuario: usuarioPublico(resultado.usuario) }, { 'set-cookie': resultado.cookie });
    } catch (e) {
      tentativas.set(ip, [...recentes, Date.now()]);
      throw e;
    }
  });

  rotas.adicionar('PUT', '/api/auth/senha', { permissao: 'ver' }, async ({ req, res, usuario }) => {
    const { senhaAtual, novaSenha } = await lerJson(req);
    const problema = validarSenha(novaSenha);
    if (problema) throw erro(400, problema);
    await autenticacao.trocarSenha(usuario, senhaAtual, novaSenha);
    enviarJson(req, res, 200, { ok: true });
  });
}
