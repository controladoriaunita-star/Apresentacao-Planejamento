/** LOGIN=desligado: o app abre sem login, com o papel de PAPEL_SEM_LOGIN. */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cliente, subirServidor } from './servidor.mjs';

let srv;
let anonimo;

before(async () => {
  srv = await subirServidor({ env: { LOGIN: 'desligado' } });
  anonimo = cliente(srv.base);
});
after(() => srv.fechar());

test('sem login a sessão já vem com o usuário de acesso livre (papel planejamento)', async () => {
  const r = await anonimo('GET', '/api/auth/sessao');
  assert.equal(r.dados.usuario.semLogin, true);
  assert.equal(r.dados.usuario.papel, 'planejamento');
});

test('sem login as rotas de leitura e de conteúdo respondem sem cookie', async () => {
  assert.equal((await anonimo('GET', '/api/dados/resumo')).status, 200);
  assert.equal((await anonimo('GET', '/api/telas')).status, 200);
});

test('sem login a administração continua fechada para o papel padrão', async () => {
  assert.equal((await anonimo('GET', '/api/usuarios')).status, 403);
});

test('PAPEL_SEM_LOGIN inválido cai no papel padrão', async () => {
  const outro = await subirServidor({ env: { LOGIN: 'desligado', PAPEL_SEM_LOGIN: 'chefe' } });
  try {
    assert.equal(outro.config.papelSemLogin, 'planejamento');
  } finally {
    await outro.fechar();
  }
});
