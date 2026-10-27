/**
 * Autenticação e gestão de usuários, com duas implementações de mesma interface:
 *
 * - AutenticacaoLocal (STORE=local): usuários em DATA_DIR/usuarios.json, senha PBKDF2.
 * - AutenticacaoSupabase (STORE=supabase): login, senha e criação de usuários no Supabase Auth; nome,
 *   papel e situação na tabela `perfis` (id = id do usuário no Auth). Desativar um usuário também o
 *   bloqueia no Auth.
 *
 * Nos dois casos o navegador recebe o cookie `sessao`, assinado com HMAC (o JS da página não lê tokens).
 * O papel é relido a cada requisição: mudar papel ou desativar vale na hora. Só entram e-mails do domínio
 * DOMINIO_EMAIL (config.dominioEmail).
 *
 * Novos usuários: no local o Dev define a senha inicial; no Supabase (`porConvite`) o Dev só informa nome, e-mail
 * e papel e o Supabase envia o convite — o link volta ao app com um token e a pessoa define a própria senha.
 *
 * Interface:
 *   porConvite · precisaConfigurar() · configurar({nome,email,senha}) · entrar(email, senha)
 *   identificar(req) → { usuario, cookie? } · sair(req) → cookie
 *   listar() · criar(dados, endereco) · atualizar(id, campos) · remover(id) · trocarSenha(usuario, atual, nova)
 *   enviarAcesso(id, endereco) · recuperarSenha(email, endereco) · definirSenha(token, senha) → { usuario, cookie }
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { erro } from '../http/respostas.mjs';
import { ColecaoJson } from '../store/json-store.mjs';
import { ColecaoSupabase } from '../store/supabase-store.mjs';
import { conferirSenha, gerarHash, validarSenha } from './senha.mjs';
import { cookieExpirado, cookieSessao, lerCookie, NOME_COOKIE } from './sessao.mjs';

const DURACAO_MS = 12 * 60 * 60 * 1000;
const SO_SUPABASE = 'Envio de e-mail só existe com o Supabase. Peça ao Dev para definir uma nova senha.';

export function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim()) ? null : 'Informe um e-mail válido.';
}

/** Nunca devolver o hash da senha. */
export function usuarioPublico({ senhaHash, ...resto }) {
  return resto;
}

const normalizarEmail = (email) => String(email ?? '').trim().toLowerCase();

function exigirDados({ nome, email, senha, papel }, { dominio, comSenha = true, comPapel = false }) {
  const problema = (String(nome ?? '').trim() ? null : 'Informe o nome.')
    ?? validarEmail(email)
    ?? (dominio && !normalizarEmail(email).endsWith(`@${dominio}`) ? `Use um e-mail @${dominio}.` : null)
    ?? (comPapel && !['dev', 'planejamento', 'viewer'].includes(papel) ? 'Papel inválido.' : null)
    ?? (comSenha ? validarSenha(senha) : null);
  if (problema) throw erro(400, problema);
}

/** Cookie assinado: base64url(JSON) + "." + HMAC-SHA256. */
function assinar(segredo, dados) {
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return `${corpo}.${createHmac('sha256', segredo).update(corpo).digest('base64url')}`;
}

function verificar(segredo, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [corpo, assinatura] = token.split('.');
  const esperada = Buffer.from(createHmac('sha256', segredo).update(corpo).digest('base64url'));
  const recebida = Buffer.from(assinatura ?? '');
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try { return JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')); } catch { return null; }
}

// ── Local ─────────────────────────────────────────────────────────────
export class AutenticacaoLocal {
  porConvite = false;

  constructor(config) {
    this.config = config;
    this.usuarios = new ColecaoJson(config.dataDir, 'usuarios');
  }

  #cookie(usuario) {
    return cookieSessao(assinar(this.config.segredoSessao, { u: usuario.id, exp: Date.now() + DURACAO_MS }), { seguro: this.config.cookieSeguro });
  }

  async precisaConfigurar() {
    return (await this.usuarios.listar()).length === 0;
  }

  async configurar(dados) {
    exigirDados(dados, { dominio: this.config.dominioEmail });
    if (!(await this.precisaConfigurar())) throw erro(409, 'O primeiro acesso já foi configurado.');
    const usuario = await this.usuarios.inserir({ nome: dados.nome.trim(), email: normalizarEmail(dados.email), papel: 'dev', ativo: true, senhaHash: gerarHash(dados.senha) });
    return { usuario: usuarioPublico(usuario), cookie: this.#cookie(usuario) };
  }

  async entrar(email, senha) {
    const usuario = await this.usuarios.buscarPor('email', normalizarEmail(email));
    if (!usuario || !usuario.ativo || !conferirSenha(senha, usuario.senhaHash)) return null;
    await this.usuarios.atualizar(usuario.id, { ultimoAcesso: new Date().toISOString() });
    return { usuario: usuarioPublico(usuario), cookie: this.#cookie(usuario) };
  }

  async identificar(req) {
    const dados = verificar(this.config.segredoSessao, lerCookie(req, NOME_COOKIE));
    if (!dados || !(dados.exp > Date.now())) return null;
    const usuario = await this.usuarios.obter(dados.u);
    return usuario?.ativo ? { usuario } : null;
  }

  async sair() {
    return cookieExpirado({ seguro: this.config.cookieSeguro });
  }

  async listar() {
    return (await this.usuarios.listar()).map(usuarioPublico);
  }

  async criar(dados) {
    exigirDados(dados, { dominio: this.config.dominioEmail, comPapel: true });
    const email = normalizarEmail(dados.email);
    if (await this.usuarios.buscarPor('email', email)) throw erro(409, 'Já existe um usuário com este e-mail.');
    return usuarioPublico(await this.usuarios.inserir({ nome: dados.nome.trim(), email, papel: dados.papel, ativo: true, senhaHash: gerarHash(dados.senha) }));
  }

  async atualizar(id, campos) {
    const alteracao = { ...campos };
    if (campos.senha) alteracao.senhaHash = gerarHash(campos.senha);
    delete alteracao.senha;
    const atualizado = await this.usuarios.atualizar(id, alteracao);
    if (!atualizado) throw erro(404, 'Usuário não encontrado.');
    return usuarioPublico(atualizado);
  }

  async remover(id) {
    if (!(await this.usuarios.remover(id))) throw erro(404, 'Usuário não encontrado.');
  }

  async trocarSenha(usuario, atual, nova) {
    if (!conferirSenha(atual, usuario.senhaHash)) throw erro(400, 'A senha atual não confere.');
    await this.usuarios.atualizar(usuario.id, { senhaHash: gerarHash(nova) });
  }

  enviarAcesso() { throw erro(400, SO_SUPABASE); }
  recuperarSenha() { throw erro(400, SO_SUPABASE); }
  definirSenha() { throw erro(400, SO_SUPABASE); }
}

// ── Supabase ──────────────────────────────────────────────────────────
export class AutenticacaoSupabase {
  porConvite = true;

  constructor(config, cliente) {
    this.config = config;
    this.cliente = cliente;
    this.perfis = new ColecaoSupabase(cliente, 'perfis', { ordem: 'nome.asc' });
  }

  #cookie(sessao) {
    const dados = { u: sessao.user.id, a: sessao.access_token, r: sessao.refresh_token, exp: Date.now() + (sessao.expires_in ?? 3600) * 1000 };
    return cookieSessao(assinar(this.config.segredoSessao, dados), { seguro: this.config.cookieSeguro });
  }

  async precisaConfigurar() {
    return (await this.perfis.listar()).length === 0;
  }

  async configurar(dados) {
    exigirDados(dados, { dominio: this.config.dominioEmail });
    if (!(await this.precisaConfigurar())) throw erro(409, 'O primeiro acesso já foi configurado.');
    await this.#criarNoAuth({ ...dados, papel: 'dev' });
    const resultado = await this.entrar(dados.email, dados.senha);
    if (!resultado) throw erro(500, 'Usuário criado, mas o login falhou. Tente entrar novamente.');
    return resultado;
  }

  async entrar(email, senha) {
    let sessao;
    try {
      sessao = await this.cliente.entrarComSenha(normalizarEmail(email), senha);
    } catch (e) {
      if (e.status === 400 || e.status === 401 || e.status === 422) return null; // credenciais inválidas
      throw e;
    }
    const perfil = await this.perfis.obter(sessao.user.id);
    if (!perfil?.ativo) return null;
    await this.perfis.atualizar(perfil.id, { ultimoAcesso: new Date().toISOString() });
    return { usuario: perfil, cookie: this.#cookie(sessao) };
  }

  async identificar(req) {
    const dados = verificar(this.config.segredoSessao, lerCookie(req, NOME_COOKIE));
    if (!dados?.u) return null;
    let cookie = null;
    if (!(dados.exp > Date.now() + 30_000)) {
      // Token de acesso vencendo: renova com o refresh token e devolve um cookie novo.
      try {
        const sessao = await this.cliente.renovarSessao(dados.r);
        cookie = this.#cookie(sessao);
      } catch {
        return null;
      }
    }
    const perfil = await this.perfis.obter(dados.u);
    return perfil?.ativo ? { usuario: perfil, cookie } : null;
  }

  async sair(req) {
    const dados = verificar(this.config.segredoSessao, lerCookie(req, NOME_COOKIE));
    if (dados?.a) await this.cliente.sair(dados.a);
    return cookieExpirado({ seguro: this.config.cookieSeguro });
  }

  listar() {
    return this.perfis.listar();
  }

  /** Com senha: usuário já confirmado (primeiro acesso). Sem senha: convite por e-mail que volta a `endereco`. */
  async #criarNoAuth({ nome, email, papel, senha }, endereco) {
    let criado;
    try {
      criado = senha
        ? await this.cliente.criarUsuarioAuth(normalizarEmail(email), senha)
        : await this.cliente.convidar(normalizarEmail(email), endereco);
    } catch (e) {
      if (e.status === 422 || e.status === 409) throw erro(409, 'Já existe um usuário com este e-mail.');
      throw e;
    }
    const id = criado.id ?? criado.user?.id;
    return this.perfis.inserir({ id, nome: nome.trim(), email: normalizarEmail(email), papel, ativo: true });
  }

  async criar(dados, endereco) {
    exigirDados(dados, { dominio: this.config.dominioEmail, comPapel: true, comSenha: false });
    return this.#criarNoAuth({ ...dados, senha: null }, endereco);
  }

  /** Reenvia o convite; quem já confirmou o e-mail (o Supabase recusa o convite) recebe o link de nova senha. */
  async enviarAcesso(id, endereco) {
    const perfil = await this.perfis.obter(id);
    if (!perfil) throw erro(404, 'Usuário não encontrado.');
    try {
      await this.cliente.convidar(perfil.email, endereco);
    } catch (e) {
      if (e.status !== 422) throw e;
      await this.cliente.recuperarSenha(perfil.email, endereco);
    }
  }

  /** "Esqueci minha senha": só envia para usuários ativos e não revela se o e-mail existe. */
  async recuperarSenha(email, endereco) {
    const perfil = await this.perfis.buscarPor('email', normalizarEmail(email));
    if (perfil?.ativo) await this.cliente.recuperarSenha(perfil.email, endereco);
  }

  /** Link do e-mail (convite ou nova senha): o token prova o dono do e-mail; grava a senha e já entra. */
  async definirSenha(token, senha) {
    const problema = validarSenha(senha);
    if (problema) throw erro(400, problema);
    let dono;
    try {
      dono = await this.cliente.usuarioDoToken(String(token ?? ''));
    } catch {
      throw erro(400, 'O link expirou ou já foi usado. Peça um novo ao Dev ou use "Esqueci minha senha".');
    }
    const perfil = await this.perfis.obter(dono.id);
    if (!perfil?.ativo) throw erro(403, 'Seu acesso está desativado. Fale com o Dev.');
    await this.cliente.atualizarUsuarioAuth(perfil.id, { password: senha });
    const resultado = await this.entrar(perfil.email, senha);
    if (!resultado) throw erro(500, 'Senha gravada, mas o login falhou. Tente entrar novamente.');
    return resultado;
  }

  async atualizar(id, campos) {
    const { senha, ...perfil } = campos;
    const auth = {};
    if (senha) auth.password = senha;
    if (campos.ativo !== undefined) auth.ban_duration = campos.ativo ? 'none' : '876000h'; // desativado = bloqueado no Auth
    if (Object.keys(auth).length) await this.cliente.atualizarUsuarioAuth(id, auth);
    const atualizado = await this.perfis.atualizar(id, perfil);
    if (!atualizado) throw erro(404, 'Usuário não encontrado.');
    return atualizado;
  }

  async remover(id) {
    if (!(await this.perfis.obter(id))) throw erro(404, 'Usuário não encontrado.');
    await this.cliente.removerUsuarioAuth(id);
    await this.perfis.remover(id);
  }

  async trocarSenha(usuario, atual, nova) {
    try {
      await this.cliente.entrarComSenha(usuario.email, atual);
    } catch {
      throw erro(400, 'A senha atual não confere.');
    }
    await this.cliente.atualizarUsuarioAuth(usuario.id, { password: nova });
  }
}
