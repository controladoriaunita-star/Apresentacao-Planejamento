/**
 * Envio de e-mail da IAT/IST com o PDF anexado, pelo servidor. Modo por EMAIL_ENVIO:
 *   graph   → Microsoft Graph (sendMail) com o mesmo aplicativo do SharePoint (MS_GRAPH_*); a caixa EMAIL_REMETENTE
 *             precisa existir e o aplicativo precisa da permissão de aplicativo Mail.Send (consentida pelo admin).
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

  async function tokenGraph() {
    const { tenantId, clientId, clientSecret } = config.graph;
    const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default' }),
    });
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok || !corpo.access_token) throw new ErroHttp(502, `Falha na autenticação com a Microsoft para enviar o e-mail: ${corpo.error_description?.split('\r\n')[0] ?? res.status}`);
    return corpo.access_token;
  }

  const modos = {
    async graph(m) {
      const destinos = (lista) => lista.map((endereco) => ({ emailAddress: { address: endereco } }));
      const res = await fetchImpl(`${GRAPH}/users/${encodeURIComponent(remetente)}/sendMail`, {
        method: 'POST',
        headers: { authorization: `Bearer ${await tokenGraph()}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: m.assunto,
            body: { contentType: 'HTML', content: m.html },
            toRecipients: destinos([m.para]),
            ccRecipients: destinos(m.copia ?? []),
            attachments: (m.anexos ?? []).map((a) => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.nome, contentType: a.tipo, contentBytes: a.dados.toString('base64') })),
          },
          saveToSentItems: true,
        }),
      });
      if (!res.ok) {
        const corpo = await res.json().catch(() => ({}));
        const dica = res.status === 403 ? ' O aplicativo precisa da permissão Mail.Send (aplicativo) consentida pelo administrador.' : '';
        throw new ErroHttp(502, `O Microsoft Graph recusou o envio (${res.status}): ${corpo.error?.message ?? res.statusText}.${dica}`);
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
