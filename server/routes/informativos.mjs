/**
 * IAT e IST (Administração → Segurança do Trabalho): rascunhos salvos pelo Planejamento/Dev, com fotos e anexos.
 *   GET    /api/seguranca/iat|ist          lista (resumo)
 *   GET    /api/seguranca/iat|ist/proximo  número que o próximo registro vai receber (último + 1)
 *   GET    /api/seguranca/iat|ist/:id      documento completo
 *   POST   /api/seguranca/iat|ist          cria (número sequencial)
 *   PUT    /api/seguranca/iat|ist/:id      atualiza (arquivos que saíram do documento são apagados)
 *   DELETE /api/seguranca/iat|ist/:id      exclui (com as fotos e anexos)
 *   POST   /api/seguranca/iat|ist/:id/enviar  envia por e-mail {qual, anexos:[ids dos PDFs]} e guarda no histórico
 *   GET    /api/seguranca/envio            como o servidor envia (graph, smtp, arquivo ou desligado)
 * Os dados têm CPF, data de nascimento e diagnóstico: leitura também exige `editarConteudo`.
 * Regras e normalização: public/js/domain/informativos.js.
 */
import {
  arquivosDoInformativo, ehMetrocasa, emailInformativo, normalizarIat, normalizarIst, pendenciasIat, pendenciasIst, pendenciasMetrocasa,
} from '../../public/js/domain/informativos.js';
import { enviarJson, erro, lerJson } from '../http/respostas.mjs';

const TIPOS = {
  iat: { normalizar: normalizarIat, nome: 'IAT', data: (d) => d.dataAcidente, titulo: (d) => d.nomeAcidentado, envios: ['iat', 'metrocasa'] },
  ist: { normalizar: normalizarIst, nome: 'IST', data: (d) => d.data, titulo: (d) => d.classificacao, envios: ['ist'] },
};
const PENDENCIAS = { iat: (d) => pendenciasIat(d), metrocasa: (d, c) => pendenciasMetrocasa(d, c), ist: (d) => pendenciasIst(d) };
const NOMES_ENVIO = { iat: 'IAT', metrocasa: 'IAT Metrocasa', ist: 'IST' };

const escapar = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/**
 * Corpo no layout do PDF (v40.5): a folha montada no navegador, com estilos inline. Limpa o que não é de e-mail
 * (scripts, estilos, iframes, eventos, javascript:) — vem do navegador de quem envia, da caixa dele mesmo.
 */
const LIMITE_HTML = 2 * 1024 * 1024;
const TAGS_PROIBIDAS = 'script|style|iframe|object|embed|link|meta|base|form';
function limparHtml(html) {
  return String(html)
    .replace(new RegExp(`<(${TAGS_PROIBIDAS})\\b[\\s\\S]*?<\\/\\1\\s*>`, 'gi'), '')
    .replace(new RegExp(`<\\/?(${TAGS_PROIBIDAS})\\b[^>]*>`, 'gi'), '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

/** Saudação e a frase do anexo (as linhas 1 e 3 do corpo em texto) + a(s) folha(s). */
function corpoComFolhas(texto, folhas) {
  const [saudacao, , frase] = texto.split('\n');
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45">'
    + `<p style="margin:0 0 4px">${escapar(saudacao)}</p><p style="margin:0 0 16px">${escapar(frase)}</p>${limparHtml(folhas)}</div>`;
}

/** Corpo HTML a partir do texto da ficha: títulos de seção (em maiúsculas) em negrito, "Rótulo: valor" com rótulo em negrito. */
function corpoHtml(texto) {
  const linhas = texto.split('\n').map((l) => {
    if (!l.trim()) return '<br>';
    if (/^[^a-z]*[A-Z]{3}[^a-z]*$/.test(l)) return `<p style="margin:14px 0 4px;font-weight:bold">${escapar(l)}</p>`;
    const m = l.match(/^([^:]{2,70}):\s(.+)$/);
    return m ? `<div><b>${escapar(m[1])}:</b> ${escapar(m[2])}</div>` : `<div>${escapar(l)}</div>`;
  });
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.45">${linhas.join('')}</div>`;
}

export function registrarInformativos(rotas, { iat, ist, cadastro, arquivos, email }) {
  const colecoes = { iat, ist };

  /** Modo de envio e a caixa que envia (a de quem está logado, no Graph). */
  rotas.adicionar('GET', '/api/seguranca/envio', { permissao: 'editarSeguranca' }, async ({ req, res, usuario }) => {
    enviarJson(req, res, 200, email.situacao(usuario.email));
  });

  for (const [tipo, def] of Object.entries(TIPOS)) {
    const colecao = colecoes[tipo];
    const base = `/api/seguranca/${tipo}`;

    async function validar(entrada) {
      const dados = def.normalizar(entrada);
      if (!dados.obraId) throw erro(400, 'Escolha a obra antes de salvar.');
      const obra = await cadastro.obter(dados.obraId);
      if (!obra) throw erro(400, 'A obra precisa existir no Cadastro de obras.');
      return { dados, obra };
    }

    const resumo = (d, porId) => ({
      id: d.id, numero: d.numero, data: def.data(d) || null, obraId: d.obraId, obra: porId.get(d.obraId)?.obra ?? null,
      titulo: def.titulo(d) || null, criadoEm: d.criadoEm, atualizadoEm: d.atualizadoEm ?? d.criadoEm, atualizadoPor: d.atualizadoPor ?? d.criadoPor,
    });

    rotas.adicionar('GET', base, { permissao: 'editarSeguranca' }, async ({ req, res }) => {
      const porId = new Map((await cadastro.listar()).map((c) => [c.id, c]));
      const lista = (await colecao.listar()).map((d) => resumo(d, porId))
        .sort((a, b) => String(b.data ?? '').localeCompare(String(a.data ?? '')) || b.numero - a.numero);
      enviarJson(req, res, 200, lista);
    });

    const proximoNumero = async () => Math.max(0, ...(await colecao.listar()).map((d) => Number(d.numero) || 0)) + 1;

    // Antes de /:id, para "proximo" não ser lido como id.
    rotas.adicionar('GET', `${base}/proximo`, { permissao: 'editarSeguranca' }, async ({ req, res }) => {
      enviarJson(req, res, 200, { numero: await proximoNumero() });
    });

    rotas.adicionar('GET', `${base}/:id`, { permissao: 'editarSeguranca' }, async ({ req, res, params }) => {
      const doc = await colecao.obter(params.id);
      if (!doc) throw erro(404, `${def.nome} não encontrada.`);
      enviarJson(req, res, 200, doc);
    });

    rotas.adicionar('POST', base, { permissao: 'editarSeguranca' }, async ({ req, res, usuario }) => {
      const { dados } = await validar(await lerJson(req, 2 * 1024 * 1024));
      const numero = await proximoNumero(); // sempre o último + 1, definido na hora de gravar
      enviarJson(req, res, 201, await colecao.inserir({ ...dados, numero, criadoPor: usuario.email }));
    });

    rotas.adicionar('PUT', `${base}/:id`, { permissao: 'editarSeguranca' }, async ({ req, res, params, usuario }) => {
      const atual = await colecao.obter(params.id);
      if (!atual) throw erro(404, `${def.nome} não encontrada.`);
      const { dados } = await validar(await lerJson(req, 2 * 1024 * 1024));
      const salvo = await colecao.atualizar(params.id, { ...dados, numero: atual.numero, atualizadoPor: usuario.email });
      const mantidos = new Set(arquivosDoInformativo({ ...dados, envios: atual.envios })); // o histórico de envios fica
      for (const id of arquivosDoInformativo(atual)) if (!mantidos.has(id)) await arquivos.remover(id).catch(() => {});
      enviarJson(req, res, 200, salvo);
    });

    /** Envia por e-mail com os PDFs gerados na tela (já enviados como arquivos) e registra no histórico. */
    rotas.adicionar('POST', `${base}/:id/enviar`, { permissao: 'editarSeguranca' }, async ({ req, res, params, usuario }) => {
      const doc = await colecao.obter(params.id);
      if (!doc) throw erro(404, `${def.nome} não encontrada.`);
      const { qual = tipo, anexos = [], html = null } = await lerJson(req, LIMITE_HTML + 64 * 1024);
      const obra = await cadastro.obter(doc.obraId);
      if (!def.envios.includes(qual) || (qual === 'metrocasa' && !ehMetrocasa(obra))) throw erro(400, 'Envio inválido para este informativo.');
      const faltam = PENDENCIAS[qual](doc, obra);
      if (faltam.length) throw erro(400, `Complete a ${NOMES_ENVIO[qual]} antes de enviar. Falta(m): ${faltam.join(', ')}.`);
      const mensagem = emailInformativo(qual, doc, obra);
      // v40.3: sem destinatário fixo — vai só para os e-mails cadastrados na obra.
      if (!mensagem.para.length) throw erro(400, `A obra ${obra?.obra ?? ''} não tem e-mails cadastrados. Cadastre em Segurança do Trabalho → E-mails das obras.`);
      if (!Array.isArray(anexos) || !anexos.length || anexos.length > 3) throw erro(400, 'Envie o PDF gerado para anexar.');
      const arquivosAnexos = [];
      for (const id of anexos) {
        const arq = await arquivos.lerDados(String(id)).catch(() => null);
        if (!arq || arq.registro.tipo !== 'application/pdf') throw erro(400, 'Anexo não encontrado ou não é PDF.');
        arquivosAnexos.push({ nome: arq.registro.nome, tipo: 'application/pdf', dados: arq.dados });
      }
      // Corpo no layout do PDF quando a tela manda a folha; senão, a ficha em texto (como antes).
      const comFolhas = typeof html === 'string' && html.trim() && html.length <= LIMITE_HTML;
      const corpo = comFolhas ? corpoComFolhas(mensagem.corpo, html) : corpoHtml(mensagem.corpo);
      const resultado = await email.enviar({ ...mensagem, de: usuario.email, texto: mensagem.corpo, html: corpo, anexos: arquivosAnexos });
      const de = email.situacao(usuario.email).remetente;
      const envio = { qual, em: new Date().toISOString(), por: usuario.email, de, modo: resultado.modo, para: mensagem.para, copia: mensagem.copia, assunto: mensagem.assunto, anexos: anexos.map(String) };
      const salvo = await colecao.atualizar(params.id, { envios: [...(doc.envios ?? []), envio] });
      enviarJson(req, res, 200, { ...envio, arquivo: resultado.arquivo ?? null, envios: salvo.envios });
    });

    rotas.adicionar('DELETE', `${base}/:id`, { permissao: 'editarSeguranca' }, async ({ req, res, params }) => {
      const removido = await colecao.remover(params.id);
      if (!removido) throw erro(404, `${def.nome} não encontrada.`);
      for (const id of arquivosDoInformativo(removido)) await arquivos.remover(id).catch(() => {});
      enviarJson(req, res, 200, { ok: true });
    });
  }
}
