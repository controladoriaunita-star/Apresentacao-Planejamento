/**
 * v36 — E-mails de acesso (convite e nova senha) enviados pelo Microsoft 365, a partir da caixa EMAIL_REMETENTE,
 * com o mesmo registro do Entra ID que lê o SharePoint (MS_GRAPH_*, permissão de aplicativo Mail.Send).
 *
 * O Supabase só gera o link (cliente.gerarLink) — sem SMTP próprio ele não entrega e-mails a quem não é membro do
 * projeto. Sem EMAIL_REMETENTE o app segue como antes (o próprio Supabase envia).
 */
import { ClienteGraph } from '../sources/graph.mjs';

const escapar = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const TEXTOS = {
  invite: {
    assunto: 'Seu acesso à Apresentação de obras — Unità',
    titulo: 'Bem-vindo(a)!',
    corpo: 'Você recebeu acesso à Apresentação de obras da Unità Engenharia. Clique no botão abaixo para criar a sua senha e entrar.',
    botao: 'Criar minha senha',
  },
  recovery: {
    assunto: 'Nova senha — Apresentação de obras Unità',
    titulo: 'Nova senha',
    corpo: 'Recebemos um pedido para criar uma nova senha de acesso à Apresentação de obras da Unità Engenharia. Clique no botão abaixo para defini-la.',
    botao: 'Criar nova senha',
  },
};

/** Assunto e HTML do e-mail (tabelas e estilos inline: funciona no Outlook e nos webmails). */
export function modeloEmail(tipo, { nome, link }) {
  const t = TEXTOS[tipo] ?? TEXTOS.recovery;
  const saudacao = nome ? `Olá, ${escapar(nome)}.` : 'Olá.';
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f8f7f6;font-family:Segoe UI,Arial,sans-serif;color:#1a1817">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2dfdc">
<tr><td style="padding:28px 32px 0">
<div style="font-size:12px;letter-spacing:1px;font-weight:700;color:#fe5000;text-transform:uppercase">Unità Engenharia · Planejamento e Controle</div>
<h1 style="margin:8px 0 16px;font-size:22px">${t.titulo}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${saudacao}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">${t.corpo}</p>
<a href="${escapar(link)}" style="display:inline-block;background:#fe5000;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;font-size:15px">${t.botao}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#77716d">O link vale por tempo limitado e só pode ser usado uma vez. Se não foi você quem pediu, ignore este e-mail — sua senha atual continua valendo.</p>
</td></tr>
<tr><td style="padding:20px 32px 28px;font-size:12px;color:#a19b96">Mensagem automática — não responda.</td></tr>
</table></td></tr></table></body></html>`;
  return { assunto: t.assunto, html };
}

export class CorreioMicrosoft {
  constructor(config, fetchImpl = fetch) {
    this.remetente = config.emailRemetente;
    const { tenantId, clientId, clientSecret } = config.graph;
    this.ativo = Boolean(this.remetente && tenantId && clientId && clientSecret);
    this.graph = this.ativo ? new ClienteGraph(config.graph, fetchImpl) : null;
  }

  /** `tipo` = "invite" | "recovery". */
  enviarAcesso(tipo, { email, nome, link }) {
    const { assunto, html } = modeloEmail(tipo, { nome, link });
    return this.graph.enviarEmail({ remetente: this.remetente, para: email, assunto, html });
  }
}
