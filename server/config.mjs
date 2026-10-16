/**
 * Configuração do servidor a partir de variáveis de ambiente (.env.local na raiz, se existir).
 * As mesmas chaves serão lidas pela versão PHP (ver docs/MIGRACAO_PHP.md).
 */
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { papelValido } from '../public/js/domain/permissoes.js';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function carregarConfig(sobrescrever = {}) {
  const arquivoEnv = join(RAIZ, '.env.local');
  if (!sobrescrever.ignorarEnvLocal && existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);
  const env = { ...process.env, ...sobrescrever.env };
  // Na Vercel só /tmp aceita escrita (e não é persistente): lá os dados ficam no Supabase.
  const dataDir = env.DATA_DIR || (env.VERCEL ? '/tmp/apresentacao' : './data');
  const papelSemLogin = String(env.PAPEL_SEM_LOGIN ?? '').trim().toLowerCase();
  const supabase = {
    url: env.SUPABASE_URL || '',
    anonKey: env.SUPABASE_ANON_KEY || '',
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    bucket: env.SUPABASE_BUCKET || 'apresentacao',
  };
  const config = {
    porta: Number(env.PORT || 5210),
    fonteDados: env.DATA_SOURCE === 'exemplo' ? 'exemplo' : 'graph',
    // Onde ficam usuários, cadastros e anexos: "supabase" (produção) ou "local" (arquivos em DATA_DIR).
    store: env.STORE === 'supabase' ? 'supabase' : 'local',
    supabase,
    dataDir: isAbsolute(dataDir) ? dataDir : join(RAIZ, dataDir),
    publicDir: join(RAIZ, 'public'),
    cacheMinutos: Number(env.CACHE_MINUTOS || 30),
    segredoSessao: env.SESSION_SECRET || null,
    // LOGIN=desligado: o app abre direto, sem tela de login, com o papel PAPEL_SEM_LOGIN (padrão: planejamento).
    semLogin: loginDesligado(env.LOGIN),
    papelSemLogin: papelValido(papelSemLogin) ? papelSemLogin : 'planejamento',
    cookieSeguro: env.COOKIE_SECURE === 'true' || Boolean(env.VERCEL),
    graph: {
      tenantId: env.MS_GRAPH_TENANT_ID || '',
      clientId: env.MS_GRAPH_CLIENT_ID || '',
      clientSecret: env.MS_GRAPH_CLIENT_SECRET || '',
      driveId: env.MS_GRAPH_DRIVE_ID || '',
      itemId: env.MS_GRAPH_ITEM_ID || '',
    },
    incc: {
      serieSgs: env.INCC_SGS_SERIE || '192',
      atualizarOnline: env.INCC_ONLINE !== 'false',
    },
    limiteUploadMB: Number(env.UPLOAD_LIMITE_MB || 25),
  };
  return { ...config, ...sobrescrever.config };
}

/** Aceita "desligado" (e off/false/nao), sem diferenciar maiúsculas, espaços ou aspas coladas no valor. */
export function loginDesligado(valor) {
  const v = String(valor ?? '').trim().replace(/^["']|["']$/g, '').trim().toLowerCase();
  return ['desligado', 'off', 'false', 'nao', 'não', '0'].includes(v);
}

export function supabaseConfigurado(config) {
  const s = config.supabase;
  return Boolean(s.url && s.anonKey && s.serviceKey);
}

export function graphConfigurado(config) {
  const g = config.graph;
  return Boolean(g.tenantId && g.clientId && g.clientSecret && g.driveId && g.itemId);
}
