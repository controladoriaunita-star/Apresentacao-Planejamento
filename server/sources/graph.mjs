/**
 * Cliente mínimo do Microsoft Graph (app-only / client credentials), sem SDK.
 * Mesmo desenho do APP-PROJEÇÃO: token em cache até perto de expirar e `fetch` injetável nos testes.
 */
const GRAPH = 'https://graph.microsoft.com/v1.0';
const TEMPO_LIMITE_MS = 90_000;

export class ErroGraph extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

export class ClienteGraph {
  #token = null;

  constructor(credenciais, fetchImpl = fetch) {
    this.credenciais = credenciais;
    this.fetch = fetchImpl;
  }

  async #tokenDeAcesso() {
    if (this.#token && Date.now() < this.#token.expiraEm) return this.#token.valor;
    const { tenantId, clientId, clientSecret } = this.credenciais;
    const res = await this.fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default' }),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok || !corpo.access_token) {
      // Nunca incluir o segredo; a descrição do Entra é segura para exibir.
      throw new ErroGraph(`Falha na autenticação com a Microsoft: ${corpo.error_description?.split('\r\n')[0] ?? res.status}`, res.status);
    }
    this.#token = { valor: corpo.access_token, expiraEm: Date.now() + Math.max((corpo.expires_in ?? 3600) - 120, 60) * 1000 };
    return this.#token.valor;
  }

  /** `usedRange(valuesOnly=true)` de uma aba → matriz de valores (linha 0 = cabeçalhos). */
  async valoresDaAba(aba) {
    const { driveId, itemId } = this.credenciais;
    const ref = encodeURIComponent(aba.replace(/'/g, "''"));
    const url = `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/workbook/worksheets('${ref}')/usedRange(valuesOnly=true)?$select=values`;
    const res = await this.fetch(url, {
      headers: { authorization: `Bearer ${await this.#tokenDeAcesso()}` },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (res.status === 401 || res.status === 403) {
      this.#token = null;
      throw new ErroGraph(`O aplicativo não tem permissão para ler a planilha no SharePoint (Graph ${res.status}).`, res.status);
    }
    if (!res.ok) {
      const corpo = await res.json().catch(() => ({}));
      throw new ErroGraph(`O Microsoft Graph respondeu ${res.status} ao ler a aba "${aba}": ${corpo.error?.message ?? res.statusText}`, res.status);
    }
    const corpo = await res.json();
    return corpo.values ?? [];
  }
}
