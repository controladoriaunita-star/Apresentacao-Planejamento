/**
 * Utilitários HTTP: leitura do corpo, respostas JSON (com gzip) e erros padronizados.
 * Formato de erro do contrato REST: `{ "erro": "mensagem para o usuário" }` + status HTTP.
 */
import { gzipSync } from 'node:zlib';

export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export const erro = (status, mensagem) => new ErroHttp(status, mensagem);

// Sem X-Frame-Options: o app abre dentro do Portal Unità (iframe), como o Quadro de Concorrência.
const CABECALHOS_SEGURANCA = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
};

export function enviarJson(req, res, status, corpo, extras = {}) {
  let dados = Buffer.from(JSON.stringify(corpo ?? null));
  const cabecalhos = { ...CABECALHOS_SEGURANCA, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extras };
  if (dados.length > 2048 && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    dados = gzipSync(dados);
    cabecalhos['content-encoding'] = 'gzip';
    cabecalhos.vary = 'accept-encoding';
  }
  cabecalhos['content-length'] = dados.length;
  res.writeHead(status, cabecalhos);
  res.end(dados);
}

export function enviarBinario(res, status, dados, tipo, extras = {}) {
  res.writeHead(status, { ...CABECALHOS_SEGURANCA, 'content-type': tipo, 'content-length': dados.length, ...extras });
  res.end(dados);
}

/** Lê o corpo inteiro respeitando um limite em bytes. */
export function lerCorpo(req, limiteBytes) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on('data', (parte) => {
      total += parte.length;
      if (total > limiteBytes) {
        reject(erro(413, `Arquivo maior que o limite de ${Math.round(limiteBytes / 1024 / 1024)} MB.`));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

export async function lerJson(req, limiteBytes = 2 * 1024 * 1024) {
  const bruto = await lerCorpo(req, limiteBytes);
  if (!bruto.length) return {};
  try {
    return JSON.parse(bruto.toString('utf8'));
  } catch {
    throw erro(400, 'Corpo da requisição não é um JSON válido.');
  }
}

export { CABECALHOS_SEGURANCA };
