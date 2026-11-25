/**
 * v35 — Login com a conta Microsoft (server/auth/microsoft.mjs), nos dois armazenamentos, com o
 * login.microsoftonline.com simulado. Cobre a aba própria (redirect), o pop-up do Portal Unità (pedido + resgate)
 * e a regra por usuário: tipo "microsoft" não usa mais senha; tipo "senha" (clientes) continua como antes.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { cliente, subirServidor } from './servidor.mjs';

const TENANT = '11111111-2222-3333-4444-555555555555';
const CLIENT = '99999999-8888-7777-6666-555555555555';
const SEGREDO = 'ficticio';
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

for (const store of ['local', 'supabase']) {
  describe(`login Microsoft (${store})`, () => {
    let srv;
    let dev;
    const contas = new Map(); // code → claims que a Microsoft simulada devolve
    const chamadasToken = [];

    /** Endpoint de token simulado: devolve o id_token das claims cadastradas para o code. */
    const fetchMicrosoft = async (url, init) => {
      assert.match(String(url), new RegExp(`^https://login\\.microsoftonline\\.com/${TENANT}/oauth2/v2\\.0/token$`));
      const corpo = new URLSearchParams(String(init.body));
      chamadasToken.push(corpo);
      const claims = contas.get(corpo.get('code'));
      if (corpo.get('client_secret') !== SEGREDO || !claims) {
        return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'AADSTS70000: código inválido.\r\nTrace ID: x' }), { status: 400 });
      }
      return new Response(JSON.stringify({ id_token: `${b64({ alg: 'RS256' })}.${b64(claims)}.assinatura` }), { status: 200 });
    };

    /** Requisição crua (sem seguir redirect), com cookies opcionais. */
    const cru = (caminho, { metodo = 'GET', cookie = '', corpo } = {}) => fetch(srv.base + caminho, {
      method: metodo,
      redirect: 'manual',
      headers: { ...(cookie ? { cookie } : {}), ...(metodo !== 'GET' ? { 'x-requested-with': 'fetch', 'content-type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const cookieDe = (res, nome) => res.headers.getSetCookie().find((c) => c.startsWith(`${nome}=`))?.split(';')[0] ?? '';

    /** Simula a volta da Microsoft para a conta `email` a partir do endereço de autorização. */
    async function voltarDaMicrosoft(urlAutorizacao, cookieOidc, claimsExtras = {}) {
      const params = new URL(urlAutorizacao).searchParams;
      const code = randomBytes(8).toString('hex');
      contas.set(code, { tid: TENANT, aud: CLIENT, nonce: params.get('nonce'), ...claimsExtras });
      return cru(`/api/auth/microsoft/callback?code=${code}&state=${encodeURIComponent(params.get('state'))}`, { cookie: cookieOidc });
    }

    before(async () => {
      srv = await subirServidor({
        store,
        fetchMicrosoft,
        env: { AUTH_MODE: 'entra', MS_GRAPH_TENANT_ID: TENANT, MS_GRAPH_CLIENT_ID: CLIENT, MS_GRAPH_CLIENT_SECRET: SEGREDO },
      });
      dev = cliente(srv.base, srv.fetchExterno);
      assert.equal((await dev('POST', '/api/auth/configurar', { nome: 'Dev', email: 'dev@unita.com.br', senha: 'senha-forte-1' })).status, 201);
    });
    after(() => srv.fechar());

    test('a tela sabe que o login Microsoft está ativo', async () => {
      assert.equal((await cliente(srv.base)('GET', '/api/auth/sessao')).dados.microsoft, true);
    });

    test('Dev cadastra conta Microsoft sem senha nem convite; cliente com senha continua como antes', async () => {
      const emailsAntes = srv.supabase?.emails.length ?? 0;
      const r = await dev('POST', '/api/usuarios', { nome: 'Eng', email: 'eng@unita.com.br', papel: 'viewer', login: 'microsoft' });
      assert.equal(r.status, 201, JSON.stringify(r.dados));
      assert.equal(r.dados.login, undefined, 'tipo padrão não é gravado (o banco assume "microsoft")');
      if (store === 'supabase') assert.equal(srv.supabase.emails.length, emailsAntes, 'nenhum convite enviado');

      assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'x@unita.com.br', papel: 'viewer', login: 'outro' })).status, 400);

      if (store === 'local') {
        assert.equal((await dev('POST', '/api/usuarios', { nome: 'Cli', email: 'cli@unita.com.br', papel: 'viewer', login: 'senha' })).status, 400, 'tipo senha exige senha');
        assert.equal((await dev('POST', '/api/usuarios', { nome: 'Cli', email: 'cli@unita.com.br', papel: 'viewer', login: 'senha', senha: 'senha-cliente-1' })).status, 201);
      } else {
        assert.equal((await dev('POST', '/api/usuarios', { nome: 'Cli', email: 'cli@unita.com.br', papel: 'viewer', login: 'senha' })).status, 201);
        const convite = srv.supabase.emails.at(-1);
        assert.deepEqual([convite.tipo, convite.email], ['invite', 'cli@unita.com.br'], 'cliente recebe convite');
        assert.equal((await cliente(srv.base, srv.fetchExterno)('POST', '/api/auth/definir-senha', { token: convite.token, senha: 'senha-cliente-1' })).status, 200);
      }
      const lista = (await dev('GET', '/api/usuarios')).dados;
      assert.equal(lista.find((u) => u.email === 'cli@unita.com.br').login, 'senha');
    });

    test('v36.3: cliente ("Senha do app") pode ter e-mail de qualquer domínio; conta Microsoft só do DOMINIO_EMAIL', async () => {
      const fora = await dev('POST', '/api/usuarios', { nome: 'Fora', email: 'fora@gmail.com', papel: 'viewer' });
      assert.equal(fora.status, 400, 'conta Microsoft de outro domínio');
      assert.match(fora.dados.erro, /@unita\.com\.br/);
      const corpo = { nome: 'Cliente Externo', email: 'Contato@Construtora-Cliente.com', papel: 'viewer', login: 'senha', ...(store === 'local' ? { senha: 'senha-cliente-9' } : {}) };
      const r = await dev('POST', '/api/usuarios', corpo);
      assert.equal(r.status, 201, JSON.stringify(r.dados));
      assert.equal(r.dados.email, 'contato@construtora-cliente.com');
      if (store === 'supabase') assert.equal(srv.supabase.emails.at(-1).email, 'contato@construtora-cliente.com', 'recebe o convite');
    });

    test('conta Microsoft não entra com senha; cliente entra com senha', async () => {
      const r = await cliente(srv.base)('POST', '/api/auth/login', { email: 'dev@unita.com.br', senha: 'senha-forte-1' });
      assert.equal(r.status, 403);
      assert.match(r.dados.erro, /conta Microsoft/);
      const c = cliente(srv.base);
      assert.equal((await c('POST', '/api/auth/login', { email: 'cli@unita.com.br', senha: 'senha-cliente-1' })).status, 200);
      assert.equal((await c('GET', '/api/auth/sessao')).dados.usuario.email, 'cli@unita.com.br');
      assert.equal((await c('POST', '/api/auth/login', { email: 'cli@unita.com.br', senha: 'errada-123' })).status, 401);
    });

    test('aba própria: Microsoft → callback → sessão do app', async () => {
      const inicio = await cru('/api/auth/microsoft/entrar');
      assert.equal(inicio.status, 302);
      const destino = new URL(inicio.headers.get('location'));
      assert.equal(`${destino.origin}${destino.pathname}`, `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
      assert.equal(destino.searchParams.get('client_id'), CLIENT);
      assert.equal(destino.searchParams.get('redirect_uri'), `${srv.base}/api/auth/microsoft/callback`);
      assert.equal(destino.searchParams.get('prompt'), 'select_account');
      const oidc = cookieDe(inicio, 'sessao_oidc');
      assert.match(inicio.headers.getSetCookie().join('\n'), /sessao_oidc=.*HttpOnly; SameSite=Lax/);

      const volta = await voltarDaMicrosoft(destino, oidc, { email: 'ENG@unita.com.br' });
      assert.equal(volta.status, 302);
      assert.equal(volta.headers.get('location'), '/');
      assert.equal(chamadasToken.at(-1).get('redirect_uri'), `${srv.base}/api/auth/microsoft/callback`, 'mesma redirect URI na troca do code');
      const sessao = cookieDe(volta, 'sessao');
      assert.ok(sessao, 'grava o cookie de sessão');
      const me = await (await cru('/api/auth/sessao', { cookie: sessao })).json();
      assert.equal(me.usuario.email, 'eng@unita.com.br');
      assert.equal((await cru('/api/dados/resumo', { cookie: sessao })).status === 401, false, 'a sessão abre as rotas protegidas');
    });

    test('callback recusa: sem cookie, outra organização, e-mail sem cadastro, usuário inativo, Microsoft recusou', async () => {
      const erroDe = (res) => decodeURIComponent(new URL(res.headers.get('location'), srv.base).searchParams.get('erro-login') ?? '');
      const iniciar = async () => {
        const res = await cru('/api/auth/microsoft/entrar');
        return { url: res.headers.get('location'), oidc: cookieDe(res, 'sessao_oidc') };
      };
      let a = await iniciar();
      assert.match(erroDe(await voltarDaMicrosoft(a.url, '', { email: 'eng@unita.com.br' })), /Login expirado/);
      a = await iniciar();
      assert.match(erroDe(await voltarDaMicrosoft(a.url, a.oidc, { email: 'eng@unita.com.br', tid: 'outro-tenant' })), /outra organização/);
      a = await iniciar();
      assert.match(erroDe(await voltarDaMicrosoft(a.url, a.oidc, { email: 'ninguem@unita.com.br' })), /ainda não tem acesso/);
      a = await iniciar();
      assert.match(erroDe(await voltarDaMicrosoft(a.url, a.oidc, { email: 'eng@unita.com.br', nonce: 'outro' })), /Login inválido/);

      const eng = (await dev('GET', '/api/usuarios')).dados.find((u) => u.email === 'eng@unita.com.br');
      assert.equal((await dev('PUT', `/api/usuarios/${eng.id}`, { ativo: false })).status, 200);
      a = await iniciar();
      assert.match(erroDe(await voltarDaMicrosoft(a.url, a.oidc, { email: 'eng@unita.com.br' })), /ainda não tem acesso/);
      assert.equal((await dev('PUT', `/api/usuarios/${eng.id}`, { ativo: true })).status, 200);

      a = await iniciar();
      const state = new URL(a.url).searchParams.get('state');
      const recusado = await cru(`/api/auth/microsoft/callback?code=invalido&state=${encodeURIComponent(state)}`, { cookie: a.oidc });
      assert.match(erroDe(recusado), /A Microsoft recusou o login\. AADSTS70000: código inválido\.$/);
      const cancelado = await cru(`/api/auth/microsoft/callback?error=access_denied&state=${encodeURIComponent(state)}`, { cookie: a.oidc });
      assert.match(erroDe(cancelado), /cancelado/);
    });

    test('pop-up do portal: pedido → Microsoft → o iframe resgata a sessão uma única vez', async () => {
      const verificador = randomBytes(32).toString('base64url');
      const pedido = createHash('sha256').update(verificador).digest('hex');

      assert.equal((await cru('/api/auth/microsoft/preparar', { metodo: 'POST', corpo: { pedido: 'curto' } })).status, 400);
      const preparo = await cru('/api/auth/microsoft/preparar', { metodo: 'POST', corpo: { pedido } });
      assert.equal(preparo.status, 200);
      const { url } = await preparo.json();
      const oidc = cookieDe(preparo, 'sessao_oidc');

      const concluir = (v) => cru('/api/auth/microsoft/concluir', { metodo: 'POST', corpo: { verificador: v } });
      assert.equal((await concluir(verificador)).status, 202, 'ainda pendente');

      const volta = await voltarDaMicrosoft(url, oidc, { preferred_username: 'eng@unita.com.br' });
      assert.equal(volta.headers.get('location'), '/?login-microsoft=fim', 'o pop-up só mostra "pode fechar"');
      assert.equal(cookieDe(volta, 'sessao'), '', 'a sessão não nasce no pop-up');

      assert.equal((await concluir(randomBytes(32).toString('base64url'))).status, 202, 'outro verificador não resgata');
      const resgate = await concluir(verificador);
      assert.equal(resgate.status, 200);
      assert.equal((await resgate.json()).usuario.email, 'eng@unita.com.br');
      const sessao = cookieDe(resgate, 'sessao');
      assert.equal((await (await cru('/api/auth/sessao', { cookie: sessao })).json()).usuario.email, 'eng@unita.com.br');
      assert.equal((await concluir(verificador)).status, 202, 'uso único');
    });

    test('pop-up: erro na Microsoft chega ao iframe', async () => {
      const verificador = randomBytes(32).toString('base64url');
      const pedido = createHash('sha256').update(verificador).digest('hex');
      const preparo = await cru('/api/auth/microsoft/preparar', { metodo: 'POST', corpo: { pedido } });
      const volta = await voltarDaMicrosoft((await preparo.json()).url, cookieDe(preparo, 'sessao_oidc'), { email: 'ninguem@unita.com.br' });
      assert.match(volta.headers.get('location'), /^\/\?login-microsoft=fim&erro-login=/);
      const r = await cru('/api/auth/microsoft/concluir', { metodo: 'POST', corpo: { verificador } });
      assert.equal(r.status, 403);
      assert.match((await r.json()).erro, /ainda não tem acesso/);
    });

    test('conta Microsoft: sem troca de senha, sem convite e sem "esqueci minha senha"', async () => {
      assert.equal((await dev('PUT', '/api/auth/senha', { senhaAtual: 'senha-forte-1', novaSenha: 'senha-forte-9' })).status, 400);
      const eng = (await dev('GET', '/api/usuarios')).dados.find((u) => u.email === 'eng@unita.com.br');
      if (store === 'local') return;
      assert.equal((await dev('POST', `/api/usuarios/${eng.id}/acesso`)).status, 400);
      const antes = srv.supabase.emails.length;
      assert.equal((await cliente(srv.base)('POST', '/api/auth/recuperar', { email: 'eng@unita.com.br' })).status, 200, 'não revela nada');
      assert.equal(srv.supabase.emails.length, antes, 'mas não envia');
      assert.equal((await cliente(srv.base)('POST', '/api/auth/recuperar', { email: 'cli@unita.com.br' })).status, 200);
      assert.equal(srv.supabase.emails.length, antes + 1, 'cliente recebe o link de nova senha');
    });

    test('Dev muda o tipo de login: quem vira "senha" volta a entrar com senha', async () => {
      const eng = (await dev('GET', '/api/usuarios')).dados.find((u) => u.email === 'eng@unita.com.br');
      assert.equal((await dev('PUT', `/api/usuarios/${eng.id}`, { login: 'qualquer' })).status, 400);
      assert.equal((await dev('PUT', `/api/usuarios/${eng.id}`, { login: 'senha', ...(store === 'local' ? { senha: 'senha-eng-123' } : {}) })).status, 200);
      if (store === 'local') {
        assert.equal((await cliente(srv.base)('POST', '/api/auth/login', { email: 'eng@unita.com.br', senha: 'senha-eng-123' })).status, 200);
      } else {
        assert.equal((await dev('POST', `/api/usuarios/${eng.id}/acesso`)).status, 200, 'agora pode receber o e-mail de acesso');
      }
    });
  });
}

test('sem AUTH_MODE=entra o login Microsoft fica desligado e tudo segue com senha', async () => {
  const srv = await subirServidor({ env: { MS_GRAPH_TENANT_ID: TENANT, MS_GRAPH_CLIENT_ID: CLIENT, MS_GRAPH_CLIENT_SECRET: 'x' } });
  try {
    const c = cliente(srv.base);
    assert.equal((await c('GET', '/api/auth/sessao')).dados.microsoft, false);
    assert.equal((await c('POST', '/api/auth/configurar', { nome: 'Dev', email: 'dev@unita.com.br', senha: 'senha-forte-1' })).status, 201);
    assert.equal((await cliente(srv.base)('POST', '/api/auth/login', { email: 'dev@unita.com.br', senha: 'senha-forte-1' })).status, 200);
    const r = await fetch(`${srv.base}/api/auth/microsoft/entrar`, { redirect: 'manual' });
    assert.match(decodeURIComponent(r.headers.get('location')), /ainda não foi configurado/);
  } finally {
    await srv.fechar();
  }
});
