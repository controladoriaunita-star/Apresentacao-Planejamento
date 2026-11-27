/** Envio de e-mail pelo servidor (server/email/envio.mjs): Microsoft Graph simulado e envio desligado. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarEnvioEmail } from '../../server/email/envio.mjs';

const configBase = (email) => ({
  dataDir: '.', graph: { tenantId: 't', clientId: 'c', clientSecret: 's' },
  email: { modo: '', remetente: '', smtp: { host: '', porta: 587, usuario: '', senha: '' }, ...email },
});
const mensagem = {
  para: 'acidentes@unitaengenharia.com.br', copia: ['eng@unita.com.br'], assunto: 'IAT nº 01', texto: 'Ficha', html: '<p>Ficha</p>',
  anexos: [{ nome: 'IAT 01.pdf', tipo: 'application/pdf', dados: Buffer.from('%PDF') }],
};

test('graph: token do aplicativo e sendMail com cópia e PDF em base64', async () => {
  const chamadas = [];
  const fetchFalso = async (url, init) => {
    chamadas.push({ url: String(url), init });
    if (String(url).includes('/oauth2/')) return new Response(JSON.stringify({ access_token: 'tk', expires_in: 3600 }), { status: 200 });
    return new Response(null, { status: 202 });
  };
  const envio = criarEnvioEmail(configBase({ modo: 'graph', remetente: 'seguranca@unitaengenharia.com.br' }), { fetchImpl: fetchFalso });
  assert.deepEqual(envio.situacao(), { modo: 'graph', remetente: 'seguranca@unitaengenharia.com.br' });
  assert.deepEqual(await envio.enviar(mensagem), { modo: 'graph' });
  const envioGraph = chamadas.find((c) => c.url.endsWith('/users/seguranca%40unitaengenharia.com.br/sendMail'));
  assert.equal(envioGraph.init.headers.authorization, 'Bearer tk');
  const corpo = JSON.parse(envioGraph.init.body);
  assert.deepEqual(corpo.message.toRecipients, [{ emailAddress: { address: 'acidentes@unitaengenharia.com.br' } }]);
  assert.deepEqual(corpo.message.ccRecipients, [{ emailAddress: { address: 'eng@unita.com.br' } }]);
  assert.equal(corpo.message.attachments[0].contentBytes, Buffer.from('%PDF').toString('base64'));
  assert.equal(corpo.message.body.contentType, 'HTML');
});

test('graph: sai da caixa de quem está logado (de); EMAIL_REMETENTE só sem "de"; 404 explica a caixa', async () => {
  const urls = [];
  let status = 202;
  const fetchFalso = async (url) => {
    urls.push(String(url));
    if (String(url).includes('/oauth2/')) return new Response(JSON.stringify({ access_token: 'tk', expires_in: 3600 }), { status: 200 });
    return status === 202 ? new Response(null, { status }) : new Response(JSON.stringify({ error: { message: 'User not found' } }), { status });
  };
  const envio = criarEnvioEmail(configBase({ modo: 'graph', remetente: 'seguranca@unitaengenharia.com.br' }), { fetchImpl: fetchFalso });
  assert.deepEqual(envio.situacao('tst.obra@unitaengenharia.com.br'), { modo: 'graph', remetente: 'tst.obra@unitaengenharia.com.br' });
  await envio.enviar({ ...mensagem, de: 'tst.obra@unitaengenharia.com.br', para: ['eng@unita.com.br', 'adm@unita.com.br'] });
  assert.ok(urls.at(-1).endsWith('/users/tst.obra%40unitaengenharia.com.br/sendMail'));
  await envio.enviar(mensagem);
  assert.ok(urls.at(-1).endsWith('/users/seguranca%40unitaengenharia.com.br/sendMail'));
  status = 404;
  await assert.rejects(envio.enviar({ ...mensagem, de: 'cliente@outro.com' }), /cliente@outro\.com não tem caixa de e-mail/);

  // Sem EMAIL_REMETENTE: o Graph funciona com a caixa de quem está logado.
  const semRemetente = criarEnvioEmail(configBase({ modo: 'graph' }), { fetchImpl: fetchFalso });
  assert.equal(semRemetente.situacao('tst.obra@unitaengenharia.com.br').modo, 'graph');
  assert.equal(semRemetente.situacao().modo, null);
});

test('graph: token reaproveitado entre envios (uma autenticação só)', async () => {
  let tokens = 0;
  const fetchFalso = async (url) => {
    if (String(url).includes('/oauth2/')) { tokens += 1; return new Response(JSON.stringify({ access_token: 'tk', expires_in: 3600 }), { status: 200 }); }
    return new Response(null, { status: 202 });
  };
  const envio = criarEnvioEmail(configBase({ modo: 'graph', remetente: 'seguranca@unitaengenharia.com.br' }), { fetchImpl: fetchFalso });
  await envio.enviar(mensagem);
  await envio.enviar(mensagem);
  assert.equal(tokens, 1);
});

test('graph: anexos acima de 3 MB vão por rascunho + sessão de upload em partes + send', async () => {
  const chamadas = [];
  const grande = Buffer.alloc(7 * 1024 * 1024, 1); // 7 MB → 3 partes de até 3,2 MB
  const fetchFalso = async (url, init = {}) => {
    const u = String(url);
    chamadas.push({ url: u, metodo: init.method, headers: init.headers ?? {}, body: init.body });
    if (u.includes('/oauth2/')) return new Response(JSON.stringify({ access_token: 'tk', expires_in: 3600 }), { status: 200 });
    if (u.endsWith('/messages') && init.method === 'POST') return new Response(JSON.stringify({ id: 'rasc-1' }), { status: 201 });
    if (u.endsWith('/createUploadSession')) return new Response(JSON.stringify({ uploadUrl: 'https://upload.exemplo/sessao' }), { status: 201 });
    if (u.startsWith('https://upload.exemplo/')) return new Response(null, { status: 200 });
    return new Response(null, { status: 202 });
  };
  const envio = criarEnvioEmail(configBase({ modo: 'graph', remetente: 'seguranca@unitaengenharia.com.br' }), { fetchImpl: fetchFalso });
  await envio.enviar({ ...mensagem, anexos: [{ nome: 'IST 01.pdf', tipo: 'application/pdf', dados: grande }] });

  assert.equal(chamadas.some((c) => c.url.endsWith('/sendMail')), false);
  const rascunho = chamadas.find((c) => c.url.endsWith('/messages') && c.metodo === 'POST');
  const corpo = JSON.parse(rascunho.body);
  assert.deepEqual(corpo.toRecipients, [{ emailAddress: { address: 'acidentes@unitaengenharia.com.br' } }]);
  assert.equal(corpo.attachments, undefined);
  const sessao = JSON.parse(chamadas.find((c) => c.url.endsWith('/messages/rasc-1/attachments/createUploadSession')).body);
  assert.deepEqual(sessao.AttachmentItem, { attachmentType: 'file', name: 'IST 01.pdf', size: grande.length, contentType: 'application/pdf' });
  const partes = chamadas.filter((c) => c.url === 'https://upload.exemplo/sessao');
  assert.equal(partes.length, 3);
  assert.equal(partes[0].headers['content-range'], `bytes 0-${3276800 - 1}/${grande.length}`);
  assert.equal(partes.at(-1).headers['content-range'], `bytes ${2 * 3276800}-${grande.length - 1}/${grande.length}`);
  assert.equal(partes.reduce((s, c) => s + c.body.length, 0), grande.length);
  for (const p of partes) assert.equal(p.headers.authorization, undefined); // a URL da sessão já autoriza
  assert.ok(chamadas.at(-1).url.endsWith('/messages/rasc-1/send'));
});

test('graph: anexo grande sem Mail.ReadWrite explica a permissão e não deixa rascunho', async () => {
  const chamadas = [];
  const fetchFalso = async (url, init = {}) => {
    const u = String(url);
    chamadas.push({ url: u, metodo: init.method });
    if (u.includes('/oauth2/')) return new Response(JSON.stringify({ access_token: 'tk' }), { status: 200 });
    return new Response(JSON.stringify({ error: { message: 'Access is denied.' } }), { status: 403 });
  };
  const envio = criarEnvioEmail(configBase({ modo: 'graph', remetente: 'seguranca@unitaengenharia.com.br' }), { fetchImpl: fetchFalso });
  await assert.rejects(envio.enviar({ ...mensagem, anexos: [{ nome: 'IST.pdf', tipo: 'application/pdf', dados: Buffer.alloc(4 * 1024 * 1024) }] }),
    (e) => e.status === 502 && /Mail\.ReadWrite/.test(e.message));
  assert.equal(chamadas.some((c) => c.metodo === 'DELETE'), false); // o rascunho nem chegou a ser criado
});

test('graph sem permissão: erro explica o Mail.Send', async () => {
  const fetchFalso = async (url) => (String(url).includes('/oauth2/')
    ? new Response(JSON.stringify({ access_token: 'tk' }), { status: 200 })
    : new Response(JSON.stringify({ error: { message: 'Access is denied.' } }), { status: 403 }));
  const envio = criarEnvioEmail(configBase({ modo: 'graph', remetente: 'seguranca@unitaengenharia.com.br' }), { fetchImpl: fetchFalso });
  await assert.rejects(envio.enviar(mensagem), /Mail\.Send/);
});

test('desligado ou incompleto: 503 com o que configurar', async () => {
  for (const email of [{ modo: '' }, { modo: 'smtp', remetente: 'a@b.com' }, { modo: 'graph' }]) {
    const envio = criarEnvioEmail(configBase(email));
    assert.equal(envio.situacao().modo, null);
    await assert.rejects(envio.enviar(mensagem), (e) => e.status === 503 && /EMAIL_ENVIO/.test(e.message));
  }
});
