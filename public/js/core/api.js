/**
 * Cliente do contrato REST (docs/API.md). Trocar o backend (Node → PHP) não muda nada aqui:
 * basta que o PHP responda nos mesmos caminhos. `BASE_API` permite hospedar a API em subpasta.
 */
const BASE_API = document.querySelector('meta[name="api-base"]')?.content || '/api';

export class ErroApi extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/** Alguns navegadores não informam o tipo de .csv/.xlsm: deduz pela extensão. */
function tipoPelaExtensao(nome) {
  const ext = String(nome).toLowerCase().split('.').pop();
  return {
    csv: 'text/csv', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf',
  }[ext] ?? 'application/octet-stream';
}

async function requisitar(metodo, caminho, { corpo, binario, tipo, nomeArquivo } = {}) {
  const cabecalhos = { 'x-requested-with': 'fetch' };
  let body;
  if (binario) {
    body = binario;
    cabecalhos['content-type'] = tipo || 'application/octet-stream';
    if (nomeArquivo) cabecalhos['x-nome-arquivo'] = encodeURIComponent(nomeArquivo);
  } else if (corpo !== undefined) {
    body = JSON.stringify(corpo);
    cabecalhos['content-type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(BASE_API + caminho, { method: metodo, headers: cabecalhos, body, credentials: 'same-origin' });
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor.');
  }
  const json = (res.headers.get('content-type') ?? '').includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('sessao-expirada'));
    throw new ErroApi(res.status, json?.erro ?? `Erro ${res.status}`);
  }
  return json;
}

export const api = {
  get: (caminho) => requisitar('GET', caminho),
  post: (caminho, corpo) => requisitar('POST', caminho, { corpo }),
  put: (caminho, corpo) => requisitar('PUT', caminho, { corpo }),
  del: (caminho) => requisitar('DELETE', caminho),

  /**
   * Envia um File/Blob e devolve o registro {id, nome, tipo, …}.
   * Primeiro pergunta ao servidor como enviar: no Supabase o arquivo vai direto ao Storage por URL
   * assinada (sem o limite de tamanho da Vercel); no modo local vai pelo próprio servidor.
   */
  async enviarArquivo(arquivo) {
    const tipo = arquivo.type || tipoPelaExtensao(arquivo.name);
    const { arquivo: registro, envio } = await requisitar('POST', '/arquivos/envio', { corpo: { nome: arquivo.name, tipo, tamanho: arquivo.size } });
    if (envio.modo !== 'direto') return requisitar('POST', '/arquivos', { binario: arquivo, tipo, nomeArquivo: arquivo.name });
    let res;
    try {
      res = await fetch(envio.url, { method: envio.metodo, headers: envio.cabecalhos, body: arquivo });
    } catch {
      res = null;
    }
    if (!res?.ok) {
      await requisitar('DELETE', `/arquivos/${encodeURIComponent(registro.id)}`).catch(() => {});
      throw new ErroApi(res?.status ?? 0, `Não foi possível enviar "${arquivo.name}" ao armazenamento.`);
    }
    return registro;
  },

  /** URL de um arquivo enviado (imagens em <img src>). */
  urlArquivo: (id) => `${BASE_API}/arquivos/${encodeURIComponent(id)}`,

  async baixarArquivo(id) {
    const res = await fetch(`${BASE_API}/arquivos/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new ErroApi(res.status, 'Arquivo não encontrado.');
    return res.arrayBuffer();
  },
};
