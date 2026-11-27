/**
 * Envio de e-mail da IAT/IST com o PDF anexado, pelo servidor. Modo por EMAIL_ENVIO:
 *   graph   → Microsoft Graph com o mesmo aplicativo do SharePoint (MS_GRAPH_*); a caixa EMAIL_REMETENTE precisa existir.
 *             Anexos até 3 MB: sendMail (permissão de aplicativo Mail.Send). Acima: rascunho + sessão de upload + send
 *             (também Mail.ReadWrite). Permissões de aplicativo consentidas pelo administrador.
 *   smtp    → SMTP (ex.: smtp.office365.com:587) com SMTP_HOST, SMTP_PORT, SMTP_USUARIO, SMTP_SENHA e EMAIL_REMETENTE.
 *   arquivo → não envia: grava a mensagem completa (.eml, com anexos) em DATA_DIR/emails-enviados — demonstração e testes.
 *   vazio   → envio desligado (a API responde 503 explicando o que configurar).
 *
 * enviar({ para, copia, assunto, texto, html, anexos: [{ nome, tipo, dados: Buffer }] }) → { modo, id, arquivo? }
 */
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErroHttp } from '../http/respostas.mjs';

const GRAPH = 'https://graph.microsoft.com/v1.0';
/** Anexos até este total vão direto no sendMail; acima, por sessão de upload (o Graph limita o pedido a 4 MB). */
const LIMITE_ENVIO_DIRETO = 3 * 1024 * 1024;
const PARTE_UPLOAD = 10 * 320 * 1024; // 3,2 MB: múltiplo de 320 KiB, abaixo do máximo de 4 MB por parte
const PERMISSAO_GRANDES = 'Mail.ReadWrite (para anexos acima de 3 MB) e Mail.Send';
const nomeArquivo = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 90);

/** Mensagem MIME (.eml) montada pelo nodemailer sem enviar (modo arquivo e teste do SMTP). */
async function compor(mensagem, remetente) {
  const { default: nodemailer } = await import('nodemailer');
  const transporte = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  const info = await transporte.sendMail(paraNodemailer(mensagem, remetente));
  return info.message;
}

const paraNodemailer = ({ para, copia = [], assunto, texto, html, anexos = [] }, remetente) => ({
  from: remetente,
  to: para,
  cc: copia.length ? copia : undefined,
  subject: assunto,
  text: texto,
  html,
  attachments: anexos.map((a) => ({ filename: a.nome, content: a.dados, contentType: a.tipo })),
});

export function criarEnvioEmail(config, { fetchImpl = fetch } = {}) {
  const { modo, remetente, smtp } = config.email;

  // Token do aplicativo reaproveitado até 5 min antes de expirar (evita uma ida à Microsoft a cada envio).
  let tokenCache = null;
  async function tokenGraph() {
    if (tokenCache && Date.now() < tokenCache.expira) return tokenCache.token;
    const { tenantId, clientId, clientSecret } = config.graph;
    const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default' }),
    });
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok || !corpo.access_token) throw new ErroHttp(502, `Falha na autenticação com a Microsoft para enviar o e-mail: ${corpo.error_description?.split('\r\n')[0] ?? res.status}`);
    tokenCache = { token: corpo.access_token, expira: Date.now() + (Math.max(600, Number(corpo.expires_in) || 3600) - 300) * 1000 };
    return tokenCache.token;
  }

  /** Chamada ao Graph com o token; erro vira 502 com a mensagem da Microsoft e a permissão que falta. */
  async function graph(metodo, caminho, corpo, permissao = 'Mail.Send') {
    const res = await fetchImpl(`${GRAPH}/users/${encodeURIComponent(remetente)}${caminho}`, {
      method: metodo,
      headers: { authorization: `Bearer ${await tokenGraph()}`, ...(corpo ? { 'content-type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (!res.ok) {
      const erroGraph = await res.json().catch(() => ({}));
      if (res.status === 401) tokenCache = null;
      const dica = res.status === 403 ? ` O aplicativo precisa da permissão ${permissao} (aplicativo) consentida pelo administrador.` : '';
      throw new ErroHttp(502, `O Microsoft Graph recusou o envio (${res.status}): ${erroGraph.error?.message ?? res.statusText}.${dica}`);
    }
    return res.status === 202 || res.status === 204 ? null : res.json().catch(() => null);
  }

  /** Anexo grande: sessão de upload do Graph, em partes (múltiplas de 320 KiB). A URL já traz a autorização. */
  async function subirAnexo(idMensagem, anexo) {
    const sessao = await graph('POST', `/messages/${encodeURIComponent(idMensagem)}/attachments/createUploadSession`, {
      AttachmentItem: { attachmentType: 'file', name: anexo.nome, size: anexo.dados.length, contentType: anexo.tipo },
    }, PERMISSAO_GRANDES);
    for (let inicio = 0; inicio < anexo.dados.length; inicio += PARTE_UPLOAD) {
      const parte = anexo.dados.subarray(inicio, inicio + PARTE_UPLOAD);
      const res = await fetchImpl(sessao.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream', 'content-length': String(parte.length), 'content-range': `bytes ${inicio}-${inicio + parte.length - 1}/${anexo.dados.length}` },
        body: parte,
      });
      if (!res.ok) throw new ErroHttp(502, `O Microsoft Graph recusou o anexo "${anexo.nome}" (${res.status}).`);
    }
  }

  const modos = {
    async graph(m) {
      const destinos = (lista) => lista.map((endereco) => ({ emailAddress: { address: endereco } }));
      const anexos = m.anexos ?? [];
      const mensagem = {
        subject: m.assunto,
        body: { contentType: 'HTML', content: m.html },
        toRecipients: destinos([m.para]),
        ccRecipients: destinos(m.copia ?? []),
      };
      const tamanho = anexos.reduce((s, a) => s + a.dados.length, 0);
      if (tamanho <= LIMITE_ENVIO_DIRETO) {
        // Até ~3 MB: tudo numa chamada (o Graph recusa pedidos acima de 4 MB, e o base64 cresce ~33%).
        await graph('POST', '/sendMail', {
          message: { ...mensagem, attachments: anexos.map((a) => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.nome, contentType: a.tipo, contentBytes: a.dados.toString('base64') })) },
          saveToSentItems: true,
        });
        return { modo: 'graph' };
      }
      // Acima disso: rascunho → anexos por sessão de upload → enviar (vai para Itens Enviados). Exige Mail.ReadWrite.
      const rascunho = await graph('POST', '/messages', mensagem, PERMISSAO_GRANDES);
      try {
        for (const anexo of anexos) await subirAnexo(rascunho.id, anexo);
        await graph('POST', `/messages/${encodeURIComponent(rascunho.id)}/send`);
      } catch (e) {
        await graph('DELETE', `/messages/${encodeURIComponent(rascunho.id)}`, null, PERMISSAO_GRANDES).catch(() => {});
        throw e;
      }
      return { modo: 'graph' };
    },

    async smtp(m) {
      const { default: nodemailer } = await import('nodemailer');
      const transporte = nodemailer.createTransport({
        host: smtp.host, port: smtp.porta, secure: smtp.porta === 465, requireTLS: smtp.porta !== 465,
        auth: smtp.usuario ? { user: smtp.usuario, pass: smtp.senha } : undefined,
      });
      try {
        const info = await transporte.sendMail(paraNodemailer(m, remetente));
        return { modo: 'smtp', id: info.messageId };
      } catch (e) {
        throw new ErroHttp(502, `O servidor de e-mail recusou o envio: ${e.response ?? e.message}`);
      }
    },

    async arquivo(m) {
      const pasta = join(config.dataDir, 'emails-enviados');
      mkdirSync(pasta, { recursive: true });
      const nome = `${new Date().toISOString().replace(/[:.]/g, '-')}-${nomeArquivo(m.assunto)}.eml`;
      await writeFile(join(pasta, nome), await compor(m, remetente));
      return { modo: 'arquivo', arquivo: nome };
    },
  };

  return {
    modo,
    remetente,
    /** O que a tela mostra antes de enviar. */
    situacao() {
      const configurado = modo === 'arquivo' || (modo === 'graph' && remetente && config.graph.tenantId && config.graph.clientId && config.graph.clientSecret)
        || (modo === 'smtp' && remetente && smtp.host);
      return { modo: configurado ? modo : null, remetente: remetente || null };
    },
    async enviar(mensagem) {
      if (!this.situacao().modo) {
        throw new ErroHttp(503, 'O envio automático de e-mail não está configurado no servidor (EMAIL_ENVIO = graph ou smtp, e EMAIL_REMETENTE).');
      }
      return modos[modo](mensagem);
    },
  };
}
