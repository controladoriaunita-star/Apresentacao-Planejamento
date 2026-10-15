/** Contrato REST com Supabase (Auth, tabelas e Storage) — simulado em memória por supabase-falso.mjs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarApp } from '../../server/app.mjs';
import { carregarConfig } from '../../server/config.mjs';
import { suiteContrato } from './contrato.mjs';

suiteContrato('supabase');

// Regressão: com a chave publishable em SUPABASE_SERVICE_ROLE_KEY o RLS devolvia listas vazias sem erro.
test('recusa partir com a chave pública no lugar da secreta', () => {
  for (const servico of ['sb_publishable_abc123', 'mesma-chave']) {
    const config = carregarConfig({
      ignorarEnvLocal: true,
      env: { STORE: 'supabase', SUPABASE_URL: 'http://supabase.falso', SUPABASE_ANON_KEY: servico === 'mesma-chave' ? servico : 'sb_publishable_x', SUPABASE_SERVICE_ROLE_KEY: servico },
    });
    assert.throws(() => criarApp(config), /chave pública/);
  }
});
