/**
 * Cliente mínimo do Supabase por HTTP (sem SDK): Auth (GoTrue), banco (PostgREST) e Storage.
 * Mesmo estilo do cliente do Graph: `fetch` injetável (os testes usam um Supabase simulado) e chamadas
 * que a versão PHP repete com cURL.
 *
 * Chaves:
 * - anon: login com senha e troca da própria senha;
 * - service role: só no servidor — criar/editar usuários, ler/gravar tabelas (RLS fechado) e Storage.
 */
export class ErroSupabase extends Error {
  constructor(mensagem, status, corpo = null) {
    super(mensagem);
    this.status = status;
    this.corpo = corpo;
  }
}

const TEMPO_LIMITE_MS = 30_000;

export class ClienteSupabase {
  constructor({ url, anonKey, serviceKey, bucket }, fetchImpl = fetch) {
    this.url = String(url).replace(/\/+$/, '');
    this.anonKey = anonKey;
    this.serviceKey = serviceKey;
    this.bucket = bucket;
    this.fetch = fetchImpl;
  }

  async #chamar(caminho, { metodo = 'GET', chave = this.serviceKey, token = null, corpo, cabecalhos = {}, bruto = false } = {}) {
    const headers = { apikey: chave, authorization: `Bearer ${token ?? chave}`, ...cabecalhos };
    let body = corpo;
    if (corpo !== undefined && !(corpo instanceof Uint8Array) && typeof corpo !== 'string') {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(corpo);
    }
    const res = await this.fetch(`${this.url}${caminho}`, { method: metodo, headers, body, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (bruto) return res;
    const texto = await res.text();
    let dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
    if (!res.ok) {
      const msg = dados?.msg ?? dados?.message ?? dados?.error_description ?? dados?.error ?? `HTTP ${res.status}`;
      throw new ErroSupabase(`Supabase: ${msg}`, res.status, dados);
    }
    return dados;
  }

  // ── Auth ────────────────────────────────────────────────────────────
  /** Login com e-mail e senha → { access_token, refresh_token, expires_in, user }. */
  entrarComSenha(email, senha) {
    return this.#chamar('/auth/v1/token?grant_type=password', { metodo: 'POST', chave: this.anonKey, corpo: { email, password: senha } });
  }

  renovarSessao(refreshToken) {
    return this.#chamar('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', chave: this.anonKey, corpo: { refresh_token: refreshToken } });
  }

  /** Usuário dono do token (valida o JWT no próprio Supabase). */
  usuarioDoToken(accessToken) {
    return this.#chamar('/auth/v1/user', { chave: this.anonKey, token: accessToken });
  }

  sair(accessToken) {
    return this.#chamar('/auth/v1/logout', { metodo: 'POST', chave: this.anonKey, token: accessToken }).catch(() => null);
  }

  criarUsuarioAuth(email, senha) {
    return this.#chamar('/auth/v1/admin/users', { metodo: 'POST', corpo: { email, password: senha, email_confirm: true } });
  }

  atualizarUsuarioAuth(id, campos) {
    return this.#chamar(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: campos });
  }

  removerUsuarioAuth(id) {
    return this.#chamar(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
  }

  // ── Banco (PostgREST) ───────────────────────────────────────────────
  /** @param {Record<string, string|number|boolean>} filtros igualdade (`coluna = valor`) */
  selecionar(tabela, filtros = {}, ordem = null) {
    const q = new URLSearchParams({ select: '*' });
    for (const [k, v] of Object.entries(filtros)) q.append(k, `eq.${v}`);
    if (ordem) q.append('order', ordem);
    return this.#chamar(`/rest/v1/${tabela}?${q}`);
  }

  async inserir(tabela, linha, { conflito = null } = {}) {
    const q = conflito ? `?on_conflict=${encodeURIComponent(conflito)}` : '';
    const prefer = `return=representation${conflito ? ',resolution=merge-duplicates' : ''}`;
    const [criada] = await this.#chamar(`/rest/v1/${tabela}${q}`, { metodo: 'POST', corpo: linha, cabecalhos: { prefer } });
    return criada;
  }

  async atualizar(tabela, filtros, campos) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) q.append(k, `eq.${v}`);
    const linhas = await this.#chamar(`/rest/v1/${tabela}?${q}`, { metodo: 'PATCH', corpo: campos, cabecalhos: { prefer: 'return=representation' } });
    return linhas[0] ?? null;
  }

  async remover(tabela, filtros) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) q.append(k, `eq.${v}`);
    const linhas = await this.#chamar(`/rest/v1/${tabela}?${q}`, { metodo: 'DELETE', cabecalhos: { prefer: 'return=representation' } });
    return linhas[0] ?? null;
  }

  // ── Storage ─────────────────────────────────────────────────────────
  #objeto = (caminho) => `${encodeURIComponent(this.bucket)}/${caminho.split('/').map(encodeURIComponent).join('/')}`;

  /** URL para o navegador enviar o arquivo direto ao Storage (PUT), sem passar pelo servidor. */
  async urlDeEnvio(caminho) {
    const r = await this.#chamar(`/storage/v1/object/upload/sign/${this.#objeto(caminho)}`, { metodo: 'POST', corpo: {} });
    return `${this.url}/storage/v1${r.url.startsWith('/') ? '' : '/'}${r.url}`;
  }

  /** URL temporária de leitura de um arquivo privado. */
  async urlDeLeitura(caminho, segundos = 3600) {
    const r = await this.#chamar(`/storage/v1/object/sign/${this.#objeto(caminho)}`, { metodo: 'POST', corpo: { expiresIn: segundos } });
    const assinada = r.signedURL ?? r.signedUrl;
    return `${this.url}/storage/v1${assinada.startsWith('/') ? '' : '/'}${assinada}`;
  }

  async removerArquivos(caminhos) {
    if (!caminhos.length) return;
    await this.#chamar(`/storage/v1/object/${encodeURIComponent(this.bucket)}`, { metodo: 'DELETE', corpo: { prefixes: caminhos } });
  }

  /** Grava um objeto pelo servidor (usado no cache das planilhas). */
  gravarObjeto(caminho, dados, tipo = 'application/json') {
    return this.#chamar(`/storage/v1/object/${this.#objeto(caminho)}`, {
      metodo: 'POST', corpo: dados, cabecalhos: { 'content-type': tipo, 'x-upsert': 'true' },
    });
  }

  /** Lê um objeto pelo servidor; `null` se não existir. */
  async lerObjeto(caminho) {
    const res = await this.#chamar(`/storage/v1/object/authenticated/${this.#objeto(caminho)}`, { bruto: true });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new ErroSupabase(`Supabase Storage respondeu ${res.status}`, res.status);
    return Buffer.from(await res.arrayBuffer());
  }
}
