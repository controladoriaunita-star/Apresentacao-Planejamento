/**
 * Migração local → Supabase (server/tools/migrar-para-supabase.mjs) contra o Supabase simulado.
 * Os dados de origem são criados pela própria API no modo local.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cliente, subirServidor } from './servidor.mjs';
import { CHAVES, criarSupabaseFalso } from './supabase-falso.mjs';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

test('migração leva usuários, cadastro, anexos, mídias e telas para o Supabase (e pode rodar de novo)', async () => {
  const srv = await subirServidor({ store: 'local' });
  const dev = cliente(srv.base);
  await dev('POST', '/api/auth/configurar', { nome: 'Dev', email: 'dev@unita.com.br', senha: 'senha-forte-1' });
  await dev('POST', '/api/usuarios', { nome: 'Plan', email: 'plan@unita.com.br', papel: 'planejamento', senha: 'senha-forte-2' });
  await dev('PUT', '/api/obras/cadastro', { obra: 'Residencial Alpha', numeroUH: 200 });
  const arquivo = (await dev('POST', '/api/arquivos', PNG, { 'content-type': 'image/png' })).dados;
  await dev('POST', '/api/midias', { tipo: 'foto', obra: 'Residencial Alpha', mes: '2026-03', arquivoId: arquivo.id });
  await dev('POST', '/api/telas', { titulo: 'Marcos', blocos: [{ tipo: 'texto', texto: 'Oi' }] });
  await dev('PUT', '/api/incc/2026-09', { indice: 1300.5 });

  const falso = criarSupabaseFalso();
  const fetchOriginal = globalThis.fetch;
  const envOriginal = { ...process.env };
  globalThis.fetch = (url, init) => (String(url).startsWith(falso.url) ? falso.fetch(url, init) : fetchOriginal(url, init));
  Object.assign(process.env, {
    DATA_DIR: srv.config.dataDir, SUPABASE_URL: falso.url, SUPABASE_ANON_KEY: CHAVES.anon, SUPABASE_SERVICE_ROLE_KEY: CHAVES.servico,
    MIGRACAO_SENHA_TEMPORARIA: 'temporaria-123',
  });
  const logs = [];
  const logOriginal = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    await import(`../../server/tools/migrar-para-supabase.mjs?rodada=1`);
    await import(`../../server/tools/migrar-para-supabase.mjs?rodada=2`); // de novo: nada duplicado
  } finally {
    console.log = logOriginal;
    globalThis.fetch = fetchOriginal;
    process.env = envOriginal;
    await srv.fechar();
  }

  assert.equal(falso.usuarios.size, 2);
  assert.deepEqual(falso.tabelas.get('perfis').map((p) => p.papel).sort(), ['dev', 'planejamento']);
  assert.equal(falso.tabelas.get('cadastro_obras').length, 1);
  assert.equal(falso.tabelas.get('cadastro_obras')[0].dados.numeroUH, 200, 'campos do cadastro em `dados`');
  assert.equal(falso.tabelas.get('arquivos').length, 1);
  assert.deepEqual(new Uint8Array(falso.objetos.get(`apresentacao/anexos/${arquivo.id}`).dados), PNG, 'binário no Storage');
  assert.equal(falso.tabelas.get('midias').length, 1);
  assert.equal(falso.tabelas.get('midias')[0].arquivo_id, arquivo.id);
  assert.equal(falso.tabelas.get('telas').length, 1);
  assert.ok(falso.objetos.has('apresentacao/sistema/incc.json'), 'INCC no Storage');
  assert.ok(logs.some((l) => l.includes('usuário criado: plan@unita.com.br')));
});
