/**
 * Monta a aplicação HTTP: dependências, rotas, sessão, permissões e arquivos estáticos.
 * `criarApp` recebe a configuração (e um `fetch` falso nos testes) e devolve o tratador de requisições —
 * o mesmo usado pelo servidor local (server/index.mjs) e pela função da Vercel (api/index.mjs).
 *
 * STORE=local    → usuários, cadastros e anexos em arquivos dentro de DATA_DIR (dev, testes, demonstração)
 * STORE=supabase → Supabase Auth (login/usuários), tabelas e Storage (produção)
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pode } from '../public/js/domain/permissoes.js';
import { AutenticacaoLocal, AutenticacaoSupabase, usuarioSemLogin } from './auth/autenticacao.mjs';
import { servirEstatico } from './http/estaticos.mjs';
import { enviarJson, ErroHttp } from './http/respostas.mjs';
import { Roteador } from './http/roteador.mjs';
import { registrarAuth } from './routes/auth.mjs';
import { registrarConteudo } from './routes/conteudo.mjs';
import { registrarDados } from './routes/dados.mjs';
import { registrarUsuarios } from './routes/usuarios.mjs';
import { FonteIncc } from './sources/incc.mjs';
import { FontePlanilhas } from './sources/planilhas.mjs';
import { supabaseConfigurado } from './config.mjs';
import { ArmazemLocal, ArmazemSupabase } from './store/armazem.mjs';
import { RepositorioArquivosLocal, RepositorioArquivosSupabase } from './store/arquivos.mjs';
import { ColecaoJson } from './store/json-store.mjs';
import { ColecaoSupabase, linhaCadastro } from './store/supabase-store.mjs';
import { ClienteSupabase } from './supabase/cliente.mjs';

export function criarApp(config, { fetchImpl } = {}) {
  mkdirSync(config.dataDir, { recursive: true });
  const deps = config.store === 'supabase' ? dependenciasSupabase(config, fetchImpl) : dependenciasLocais(config, fetchImpl);

  const rotas = new Roteador();
  registrarAuth(rotas, deps);
  registrarUsuarios(rotas, deps);
  registrarDados(rotas, deps);
  registrarConteudo(rotas, deps);

  async function tratar(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (req.method === 'GET' && (await servirEstatico(config.publicDir, url.pathname, res))) return;
        return enviarJson(req, res, 404, { erro: 'Página não encontrada.' });
      }
      const encontrada = rotas.encontrar(req.method, url.pathname);
      if (!encontrada) return enviarJson(req, res, 404, { erro: 'Rota não encontrada.' });
      const { rota, params } = encontrada;

      // Proteção contra CSRF: toda escrita precisa vir do fetch do próprio app.
      if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'fetch') {
        return enviarJson(req, res, 403, { erro: 'Requisição recusada.' });
      }

      const sessao = config.semLogin ? { usuario: usuarioSemLogin(config.papelSemLogin) } : await deps.autenticacao.identificar(req);
      const usuario = sessao?.usuario ?? null;
      if (sessao?.cookie) res.setHeader('set-cookie', sessao.cookie); // token renovado (Supabase)
      if (rota.permissao) {
        if (!usuario) return enviarJson(req, res, 401, { erro: 'Faça login para continuar.' });
        if (!pode(usuario.papel, rota.permissao)) return enviarJson(req, res, 403, { erro: 'Seu perfil não tem permissão para esta ação.' });
      }
      await rota.tratador({ req, res, url, params, usuario, deps });
    } catch (e) {
      if (e instanceof ErroHttp) return enviarJson(req, res, e.status, { erro: e.message });
      console.error(`[erro] ${req.method} ${url.pathname}:`, e);
      const status = typeof e.status === 'number' && e.status >= 400 ? 502 : 500;
      if (!res.headersSent) enviarJson(req, res, status, { erro: status === 502 ? e.message : 'Erro interno. Tente novamente.' });
    }
  }
  tratar.preCarregar = () => deps.planilhas.preCarregar();
  return tratar;
}

function dependenciasLocais(config, fetchImpl) {
  config.segredoSessao ??= segredoPersistido(config.dataDir);
  const armazem = new ArmazemLocal(config.dataDir);
  return {
    config,
    autenticacao: new AutenticacaoLocal(config),
    cadastro: new ColecaoJson(config.dataDir, 'cadastro-obras'),
    midias: new ColecaoJson(config.dataDir, 'midias'),
    telas: new ColecaoJson(config.dataDir, 'telas'),
    arquivos: new RepositorioArquivosLocal(config.dataDir),
    planilhas: new FontePlanilhas(config, fetchImpl, armazem),
    incc: new FonteIncc(config, fetchImpl, armazem),
  };
}

function dependenciasSupabase(config, fetchImpl) {
  if (!supabaseConfigurado(config)) {
    throw new Error('STORE=supabase exige SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.');
  }
  // Com a chave pública no lugar da secreta o RLS devolve listas vazias sem erro: melhor falhar na partida.
  const { anonKey, serviceKey } = config.supabase;
  if (serviceKey === anonKey || serviceKey.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY recebeu a chave pública (publishable/anon). Use a chave secreta (sb_secret_… ou service_role).');
  }
  // Sem disco persistente (Vercel): o segredo do cookie vem do ambiente ou é derivado da service role.
  config.segredoSessao ??= createHash('sha256').update(`sessao:${config.supabase.serviceKey}`).digest('hex');
  const cliente = new ClienteSupabase(config.supabase, fetchImpl);
  const armazem = new ArmazemSupabase(cliente);
  return {
    config,
    autenticacao: new AutenticacaoSupabase(config, cliente),
    cadastro: new ColecaoSupabase(cliente, 'cadastro_obras', { mapa: linhaCadastro, ordem: 'obra.asc' }),
    midias: new ColecaoSupabase(cliente, 'midias'),
    telas: new ColecaoSupabase(cliente, 'telas'),
    arquivos: new RepositorioArquivosSupabase(cliente),
    planilhas: new FontePlanilhas(config, fetchImpl, armazem),
    incc: new FonteIncc(config, fetchImpl, armazem),
  };
}

/** Segredo das sessões: SESSION_SECRET ou um aleatório gravado em DATA_DIR/.segredo na primeira execução. */
function segredoPersistido(dataDir) {
  const arquivo = join(dataDir, '.segredo');
  if (!existsSync(arquivo)) writeFileSync(arquivo, randomBytes(32).toString('hex'));
  return readFileSync(arquivo, 'utf8').trim();
}
