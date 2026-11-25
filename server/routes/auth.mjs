/**
 * Rotas de autenticação: login, logout, sessão, primeiro acesso, troca da própria senha e o link por e-mail
 * (convite / "esqueci minha senha", só no Supabase). A regra fica no provedor (autenticacao.mjs).
 * v35: login com a conta Microsoft (/api/auth/microsoft/*), regra em auth/microsoft.mjs.
 */
import { validarSenha } from '../auth/senha.mjs';
import { usuarioPublico } from '../auth/autenticacao.mjs';
import { NOME_COOKIE_OIDC } from '../auth/microsoft.mjs';
import { lerCookie } from '../auth/sessao.mjs';
import { CABECALHOS_SEGURANCA, enviarJson, erro, lerJson } from '../http/respostas.mjs';

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

function redirecionar(res, destino, cookies = []) {
  res.writeHead(302, { ...CABECALHOS_SEGURANCA, location: destino, 'cache-control': 'no-store', ...(cookies.length ? { 'set-cookie': cookies } : {}) });
  res.end();
}

export function registrarAuth(rotas, { autenticacao, loginMicrosoft }) {
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
      microsoft: loginMicrosoft.ativo, // v35: mostra o botão "Entrar com a conta Microsoft"
    });
  });

  // ── v35: login com a conta Microsoft (server/auth/microsoft.mjs) ──
  const origem = (req) => enderecoDoApp(req).replace(/\/+$/, '');

  /** Aba própria: navegação de página inteira até a Microsoft. */
  rotas.adicionar('GET', '/api/auth/microsoft/entrar', { permissao: null }, async ({ req, res }) => {
    try {
      const { url, cookie } = loginMicrosoft.iniciar(origem(req));
      redirecionar(res, url, [cookie]);
    } catch (e) {
      redirecionar(res, `/?erro-login=${encodeURIComponent(e.message)}`);
    }
  });

  /** Pop-up do portal: recebe o hash do verificador do iframe e devolve o endereço da Microsoft. */
  rotas.adicionar('POST', '/api/auth/microsoft/preparar', { permissao: null }, async ({ req, res }) => {
    const { pedido } = await lerJson(req);
    const { url, cookie } = loginMicrosoft.iniciar(origem(req), String(pedido ?? ''));
    enviarJson(req, res, 200, { url }, { 'set-cookie': cookie });
  });

  /** Retorno da Microsoft (Redirect URI cadastrada no Entra ID). */
  rotas.adicionar('GET', '/api/auth/microsoft/callback', { permissao: null }, async ({ req, res, url }) => {
    const { cookies, destino } = await loginMicrosoft.retorno(url.searchParams, lerCookie(req, NOME_COOKIE_OIDC));
    redirecionar(res, destino, cookies);
  });

  /** Pop-up do portal: o iframe resgata a sessão com o verificador (202 = o login ainda não terminou). */
  rotas.adicionar('POST', '/api/auth/microsoft/concluir', { permissao: null }, async ({ req, res }) => {
    const { verificador } = await lerJson(req);
    const resultado = await loginMicrosoft.resgatar(verificador);
    if (!resultado) return enviarJson(req, res, 202, { pendente: true });
    enviarJson(req, res, 200, { usuario: usuarioPublico(resultado.usuario) }, { 'set-cookie': resultado.cookie });
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

  rotas.adicionar('PUT', '/api/auth/senha', { permissao: 'conta' }, async ({ req, res, usuario }) => {
    const { senhaAtual, novaSenha } = await lerJson(req);
    const problema = validarSenha(novaSenha);
    if (problema) throw erro(400, problema);
    await autenticacao.trocarSenha(usuario, senhaAtual, novaSenha);
    enviarJson(req, res, 200, { ok: true });
  });
}
