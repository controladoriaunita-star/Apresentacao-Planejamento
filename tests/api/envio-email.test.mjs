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
