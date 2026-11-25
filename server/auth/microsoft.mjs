/**
 * v35 — Login com a conta Microsoft (Office 365 / Entra ID): OpenID Connect, authorization code, feito todo no
 * servidor, sem biblioteca e sem token da Microsoft no navegador. A sessão continua sendo o cookie `sessao` do app.
 *
 * Só entra quem já está cadastrado no app (pelo e-mail) e ativo; contas de outra organização são recusadas.
 *
 * Dois caminhos, com o mesmo retorno (/api/auth/microsoft/callback):
 * - Aba própria: GET /entrar → Microsoft → callback grava o cookie de sessão e volta para "/".
 * - Dentro do iframe do Portal Unità: a Microsoft não abre em iframe, então o login roda num pop-up. O iframe sorteia
 *   um `verificador` e manda ao pop-up só o hash dele (`pedido`), por postMessage conferindo a origem (front:
 *   pages/login-microsoft.js). O callback guarda o resultado no armazém com o nome do pedido e o iframe o resgata
 *   apresentando o verificador (POST /concluir) — o cookie nasce dentro do iframe, na partição certa. Um link
 *   forjado não serve: quem não tem o verificador não resgata a sessão.
 */
import { createHash, randomBytes } from 'node:crypto';
import { microsoftAtivo } from '../config.mjs';
import { erro } from '../http/respostas.mjs';
import { assinar, verificar } from './autenticacao.mjs';

export const NOME_COOKIE_OIDC = 'sessao_oidc';
const VALIDADE_MS = 10 * 60 * 1000;
const PREFIXO_PEDIDO = 'login-microsoft/';
const ESCOPOS = 'openid profile email';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const hashPedido = (verificador) => createHash('sha256').update(String(verificador)).digest('hex');
const pedidoValido = (pedido) => typeof pedido === 'string' && /^[0-9a-f]{64}$/.test(pedido);

/** Cookie temporário do state. SameSite=Lax: o retorno da Microsoft é uma navegação GET vinda de outro site. */
export function cookieOidc(valor, { seguro, maxAge = VALIDADE_MS / 1000 }) {
  return [`${NOME_COOKIE_OIDC}=${encodeURIComponent(valor)}`, 'Path=/api/auth/microsoft', 'HttpOnly', 'SameSite=Lax', ...(seguro ? ['Secure'] : []), `Max-Age=${maxAge}`].join('; ');
}

/** Erro mostrado na tela de login; `pedido` diz para qual pop-up devolver a mensagem. */
class ErroLogin extends Error {
  constructor(mensagem, pedido = null) {
    super(mensagem);
    this.pedido = pedido;
  }
}

export class LoginMicrosoft {
  constructor(config, { autenticacao, armazem, fetchImpl = fetch }) {
    this.config = config;
    this.autenticacao = autenticacao;
    this.armazem = armazem;
    this.fetch = fetchImpl;
  }

  get ativo() {
    return microsoftAtivo(this.config);
  }

  get #ms() {
    return this.config.microsoft;
  }

  #cookieLimpo() {
    return cookieOidc('', { seguro: this.config.cookieSeguro, maxAge: 0 });
  }

  /**
   * 1ª etapa: endereço da Microsoft + cookie com o state assinado.
   * @param {string} origem  endereço do app que recebeu a requisição (sem barra no fim); APP_URL tem precedência
   * @param {string|null} pedido  hash do verificador do iframe (pop-up do portal) ou null (aba própria)
   */
  iniciar(origem, pedido = null) {
    if (!this.ativo) throw erro(503, 'O login Microsoft ainda não foi configurado.');
    if (pedido !== null && !pedidoValido(pedido)) throw erro(400, 'Pedido de login inválido.');
    const redirectUri = `${this.#ms.appUrl || origem}/api/auth/microsoft/callback`;
    const nonce = randomBytes(16).toString('base64url');
    const state = assinar(this.config.segredoSessao, { n: nonce, p: pedido, r: redirectUri, exp: Date.now() + VALIDADE_MS });
    const q = new URLSearchParams({
      client_id: this.#ms.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: ESCOPOS,
      state,
      nonce,
      prompt: 'select_account', // sempre mostra a escolha de conta (PC compartilhado / várias contas)
    });
    return {
      url: `https://login.microsoftonline.com/${encodeURIComponent(this.#ms.tenantId)}/oauth2/v2.0/authorize?${q}`,
      cookie: cookieOidc(state, { seguro: this.config.cookieSeguro }),
    };
  }

  /**
   * 2ª etapa (callback): confere o state, troca o code pelo id_token e encontra o usuário do app.
   * Aba própria → { cookies, destino: "/" } com a sessão. Pop-up → guarda o resultado para o iframe resgatar.
   * Erros nunca escapam: viram o destino com a mensagem (`?erro-login=`).
   */
  async retorno(params, cookieState) {
    const state = params.get('state') ?? '';
    const dados = verificar(this.config.segredoSessao, state);
    const pedido = pedidoValido(dados?.p) ? dados.p : null;
    const cookies = [this.#cookieLimpo()];
    try {
      if (!dados || state !== cookieState || !(dados.exp > Date.now())) throw new ErroLogin('Login expirado. Tente entrar de novo.');
      if (params.get('error')) {
        throw new ErroLogin(params.get('error') === 'access_denied' ? 'Login cancelado.' : `A Microsoft recusou o login. ${primeiraLinha(params.get('error_description'))}`.trim());
      }
      const code = params.get('code');
      if (!code) throw new ErroLogin('Login cancelado.');
      const usuario = await this.#usuarioDoCode(code, dados);
      if (pedido) {
        await this.#guardar(pedido, { email: usuario.email });
        return { cookies, destino: '/?login-microsoft=fim' };
      }
      const { cookie } = await this.autenticacao.sessaoMicrosoft(usuario);
      return { cookies: [...cookies, cookie], destino: '/' };
    } catch (e) {
      const mensagem = e instanceof ErroLogin ? e.message : 'Não foi possível concluir o login. Tente de novo.';
      if (!(e instanceof ErroLogin)) console.error('[login microsoft]', e);
      if (pedido) await this.#guardar(pedido, { erro: mensagem }).catch(() => null);
      const fim = pedido ? 'login-microsoft=fim&' : '';
      return { cookies, destino: `/?${fim}erro-login=${encodeURIComponent(mensagem)}` };
    }
  }

  async #usuarioDoCode(code, estado) {
    const res = await this.fetch(`https://login.microsoftonline.com/${encodeURIComponent(this.#ms.tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.#ms.clientId,
        client_secret: this.#ms.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: estado.r,
        scope: ESCOPOS,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const dados = await res.json().catch(() => ({}));
    if (!res.ok || !dados.id_token) throw new ErroLogin(`A Microsoft recusou o login. ${primeiraLinha(dados.error_description)}`.trim());

    // O id_token veio direto do endpoint de token (TLS + client secret): basta ler as claims.
    let claims;
    try {
      claims = JSON.parse(Buffer.from(dados.id_token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    } catch {
      throw new ErroLogin('Resposta inválida da Microsoft. Tente de novo.');
    }
    if (GUID.test(this.#ms.tenantId) && claims.tid !== this.#ms.tenantId) throw new ErroLogin('Conta de outra organização.');
    if (claims.aud !== this.#ms.clientId || claims.nonce !== estado.n) throw new ErroLogin('Login inválido. Tente de novo.');

    const email = String(claims.email ?? claims.preferred_username ?? '').trim().toLowerCase();
    const usuario = email ? await this.autenticacao.usuarioPorEmail(email) : null;
    if (!usuario) throw new ErroLogin(`O e-mail ${email || 'desta conta'} ainda não tem acesso ao app. Peça a liberação ao Dev.`);
    return usuario;
  }

  #guardar(pedido, resultado) {
    return this.armazem.gravar(`${PREFIXO_PEDIDO}${pedido}`, { ...resultado, exp: Date.now() + VALIDADE_MS });
  }

  /** Pop-up do portal: o iframe apresenta o verificador. null = o login ainda não terminou. */
  async resgatar(verificador) {
    if (typeof verificador !== 'string' || verificador.length < 32) throw erro(400, 'Pedido de login inválido.');
    const nome = `${PREFIXO_PEDIDO}${hashPedido(verificador)}`;
    const resultado = await this.armazem.ler(nome);
    if (!resultado) return null;
    await this.armazem.remover(nome); // uso único
    if (!(resultado.exp > Date.now())) throw erro(400, 'Login expirado. Tente entrar de novo.');
    if (resultado.erro) throw erro(403, resultado.erro);
    const usuario = await this.autenticacao.usuarioPorEmail(resultado.email);
    if (!usuario) throw erro(403, 'Seu acesso está desativado. Fale com o Dev.');
    return this.autenticacao.sessaoMicrosoft(usuario);
  }
}

/** Só o código e a frase do erro da Microsoft (sem Trace ID / Correlation ID / Timestamp). */
const primeiraLinha = (texto) => String(texto ?? '').split(/\r?\n|\s+Trace ID:/)[0].trim();
