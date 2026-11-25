/**
 * v36 — Convite e "esqueci minha senha" enviados pelo Microsoft 365 (server/auth/correio.mjs), com o Supabase e o
 * Graph simulados: o Supabase só gera o link (generate_link) e o app envia o e-mail a partir de EMAIL_REMETENTE.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { modeloEmail } from '../../server/auth/correio.mjs';
import { cliente, subirServidor } from './servidor.mjs';

const REMETENTE = 'planejamento.controle@unita.com.br';
const SEGREDO = 'ficticio';

describe('e-mails de acesso pelo Microsoft 365 (supabase)', () => {
  let srv;
  let dev;
  const enviados = []; // { remetente, para, assunto, html }
  let falhar = false;

  const fetchMicrosoft = async (url, init) => {
    const endereco = String(url);
    if (endereco.includes('/oauth2/v2.0/token')) {
      const corpo = new URLSearchParams(String(init.body));
      assert.equal(corpo.get('grant_type'), 'client_credentials');
      return new Response(JSON.stringify({ access_token: 'token-graph', expires_in: 3600 }), { status: 200 });
    }
    const m = endereco.match(/^https:\/\/graph\.microsoft\.com\/v1\.0\/users\/([^/]+)\/sendMail$/);
    assert.ok(m, `chamada inesperada ao Graph: ${endereco}`);
    assert.equal(init.headers.authorization, 'Bearer token-graph');
    if (falhar) return new Response(JSON.stringify({ error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } }), { status: 403 });
    const { message, saveToSentItems } = JSON.parse(init.body);
    assert.equal(saveToSentItems, true, 'cópia em Itens Enviados');
    enviados.push({ remetente: decodeURIComponent(m[1]), para: message.toRecipients[0].emailAddress.address, assunto: message.subject, html: message.body.content });
    return new Response(null, { status: 202 });
  };

  /** Token que o link do e-mail leva (o Supabase o devolve ao app no endereço, como hoje). */
  const tokenDo = (html) => decodeURIComponent(html.match(/token=([^&"]+)/)[1].replaceAll('&amp;', '&'));

  before(async () => {
    srv = await subirServidor({
      store: 'supabase',
      fetchMicrosoft,
      env: { EMAIL_REMETENTE: REMETENTE, MS_GRAPH_TENANT_ID: 'tenant', MS_GRAPH_CLIENT_ID: 'cliente', MS_GRAPH_CLIENT_SECRET: SEGREDO },
    });
    dev = cliente(srv.base, srv.fetchExterno);
    assert.equal((await dev('POST', '/api/auth/configurar', { nome: 'Dev', email: 'dev@unita.com.br', senha: 'senha-forte-1' })).status, 201);
  });
  after(() => srv.fechar());

  test('/api/saude informa que os e-mails saem pelo 365', async () => {
    assert.equal((await cliente(srv.base)('GET', '/api/saude')).dados.emails, '365');
  });

  test('convite de cliente sai pelo 365, não pelo Supabase, e o link cria a senha', async () => {
    const r = await dev('POST', '/api/usuarios', { nome: 'Cliente <Teste>', email: 'cli@unita.com.br', papel: 'viewer', login: 'senha' });
    assert.equal(r.status, 201, JSON.stringify(r.dados));
    assert.equal(srv.supabase.emails.length, 0, 'o Supabase não envia nada');
    const e = enviados.at(-1);
    assert.deepEqual([e.remetente, e.para], [REMETENTE, 'cli@unita.com.br']);
    assert.match(e.assunto, /acesso/i);
    assert.match(e.html, /Criar minha senha/);
    assert.match(e.html, /Olá, Cliente &lt;Teste&gt;\./, 'nome escapado');
    assert.match(e.html, /redirect_to=http%3A%2F%2F127\.0\.0\.1%3A\d+%2F/, 'o link volta para o próprio app');

    const nova = cliente(srv.base, srv.fetchExterno);
    assert.equal((await nova('POST', '/api/auth/definir-senha', { token: tokenDo(e.html), senha: 'senha-cliente-1' })).status, 200);
    assert.equal((await nova('GET', '/api/auth/sessao')).dados.usuario.email, 'cli@unita.com.br');
  });

  test('"esqueci minha senha" envia o link de nova senha pelo 365; e-mail desconhecido não envia nada', async () => {
    const antes = enviados.length;
    assert.equal((await cliente(srv.base)('POST', '/api/auth/recuperar', { email: 'ninguem@unita.com.br' })).status, 200);
    assert.equal(enviados.length, antes);

    assert.equal((await cliente(srv.base)('POST', '/api/auth/recuperar', { email: 'CLI@unita.com.br' })).status, 200);
    const e = enviados.at(-1);
    assert.deepEqual([e.para, e.assunto], ['cli@unita.com.br', 'Nova senha — Apresentação de obras Unità']);
    assert.match(e.html, /Criar nova senha/);
    const c = cliente(srv.base, srv.fetchExterno);
    assert.equal((await c('POST', '/api/auth/definir-senha', { token: tokenDo(e.html), senha: 'senha-cliente-2' })).status, 200);
    assert.equal((await cliente(srv.base)('POST', '/api/auth/login', { email: 'cli@unita.com.br', senha: 'senha-cliente-2' })).status, 200, 'entra com a senha nova');
  });

  test('"Reenviar e-mail de acesso": quem já criou a senha recebe o link de nova senha', async () => {
    const cli = (await dev('GET', '/api/usuarios')).dados.find((u) => u.email === 'cli@unita.com.br');
    assert.equal((await dev('POST', `/api/usuarios/${cli.id}/acesso`)).status, 200);
    assert.match(enviados.at(-1).assunto, /Nova senha/);
    assert.equal(srv.supabase.emails.length, 0);
  });

  test('falha no 365: erro claro, sem perder o usuário criado; depois o reenvio manda o convite', async () => {
    falhar = true;
    const r = await cliente(srv.base)('POST', '/api/auth/recuperar', { email: 'cli@unita.com.br' });
    assert.equal(r.status, 502);
    assert.match(r.dados.erro, /Não foi possível enviar o e-mail/);

    const criado = await dev('POST', '/api/usuarios', { nome: 'Outro', email: 'outro@unita.com.br', papel: 'viewer', login: 'senha' });
    assert.equal(criado.status, 502);
    assert.match(criado.dados.erro, /Usuário criado, mas o convite não foi enviado.*Mail\.Send.*Reenviar e-mail de acesso/);
    const outro = (await dev('GET', '/api/usuarios')).dados.find((u) => u.email === 'outro@unita.com.br');
    assert.ok(outro, 'o usuário ficou cadastrado');

    falhar = false;
    assert.equal((await dev('POST', `/api/usuarios/${outro.id}/acesso`)).status, 200);
    assert.deepEqual([enviados.at(-1).para, /Criar minha senha/.test(enviados.at(-1).html)], ['outro@unita.com.br', true], 'quem nunca entrou recebe o convite');
  });
});

test('modelo do e-mail: assunto, botão e link escapado', () => {
  const { assunto, html } = modeloEmail('invite', { nome: 'Ana', link: 'https://x.supabase.co/auth/v1/verify?token=a&type=invite' });
  assert.match(assunto, /Seu acesso/);
  assert.match(html, /href="https:\/\/x\.supabase\.co\/auth\/v1\/verify\?token=a&amp;type=invite"/);
  assert.match(html, /Olá, Ana\./);
});
