/**
 * Sobe o servidor real (DATA_SOURCE=exemplo) numa porta livre, com pasta de dados temporária.
 * `store: 'supabase'` usa o Supabase simulado (supabase-falso.mjs) no lugar do real.
 */
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarApp } from '../../server/app.mjs';
import { carregarConfig } from '../../server/config.mjs';
import { CHAVES, criarSupabaseFalso } from './supabase-falso.mjs';

export async function subirServidor({ store = 'local' } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'apresentacao-teste-'));
  const supabase = store === 'supabase' ? criarSupabaseFalso() : null;
  const config = carregarConfig({
    ignorarEnvLocal: true,
    env: {
      DATA_SOURCE: 'exemplo', INCC_ONLINE: 'false', SESSION_SECRET: 'segredo-de-teste', STORE: store, EXIGIR_LOGIN: 'true',
      SUPABASE_URL: supabase?.url ?? '', SUPABASE_ANON_KEY: CHAVES.anon, SUPABASE_SERVICE_ROLE_KEY: CHAVES.servico,
    },
    config: { dataDir },
  });
  const fetchImpl = (url, init) => (supabase && String(url).startsWith(supabase.url) ? supabase.fetch(url, init) : fetch(url, init));
  const servidor = createServer(criarApp(config, { fetchImpl }));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return {
    base,
    config,
    supabase,
    /** fetch que alcança o Supabase simulado (envio direto e URLs assinadas) ou a rede. */
    fetchExterno: fetchImpl,
    async fechar() {
      await new Promise((r) => servidor.close(r));
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/**
 * Cliente HTTP com cookie de sessão, como o navegador. Redirecionamentos para o Supabase (URL assinada
 * de leitura) são seguidos pelo `fetchExterno`.
 */
export function cliente(base, fetchExterno = fetch) {
  let cookie = '';
  return async function chamar(metodo, caminho, corpo, cabecalhos = {}) {
    const binario = corpo instanceof Uint8Array;
    let res = await fetch(base + caminho, {
      method: metodo,
      redirect: 'manual',
      headers: {
        ...(metodo !== 'GET' ? { 'x-requested-with': 'fetch' } : {}),
        ...(corpo && !binario ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...cabecalhos,
      },
      body: corpo ? (binario ? corpo : JSON.stringify(corpo)) : undefined,
    });
    const novo = res.headers.get('set-cookie');
    if (novo) cookie = novo.split(';')[0];
    if (res.status === 302) res = await fetchExterno(res.headers.get('location'));
    const tipo = res.headers.get('content-type') ?? '';
    const dados = tipo.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, dados, res };
  };
}

/** Envio de arquivo como o front faz (api.enviarArquivo): pede o modo e envia direto ou pelo servidor. */
export async function enviarArquivo(chamar, fetchExterno, dados, tipo, nome = 'arquivo') {
  const preparo = await chamar('POST', '/api/arquivos/envio', { nome, tipo, tamanho: dados.length });
  if (preparo.status !== 200) return preparo;
  const { arquivo, envio } = preparo.dados;
  if (envio.modo !== 'direto') return chamar('POST', '/api/arquivos', dados, { 'content-type': tipo, 'x-nome-arquivo': encodeURIComponent(nome) });
  const res = await fetchExterno(envio.url, { method: envio.metodo, headers: envio.cabecalhos, body: dados });
  return { status: res.ok ? 201 : res.status, dados: arquivo };
}
