/**
 * v29 — Comentários por tela (obra + mês + tela). Leitura: equipe interna (editarConteudo = Dev e Planejamento);
 * criar e apagar: só o Dev (administrar). Um documento do armazém por obra e mês (sem tabela nova no Supabase).
 */
import { randomUUID } from 'node:crypto';
import { documentoComentarios, mesValido, validarComentario } from '../../public/js/domain/comentarios-telas.js';
import { enviarJson, erro, lerJson } from '../http/respostas.mjs';

export function registrarComentarios(rotas, { armazem }) {
  const ler = async (obra, mes) => (await armazem.ler(documentoComentarios(obra, mes)).catch(() => null))?.comentarios ?? [];
  const gravar = (obra, mes, comentarios) => armazem.gravar(documentoComentarios(obra, mes), { obra, mes, comentarios });
  const obraEMes = (url, acesso) => {
    const obra = url.searchParams.get('obra');
    const mes = url.searchParams.get('mes');
    if (!obra || !mesValido(mes)) throw erro(400, 'Informe a obra e o mês (AAAA-MM).');
    if (!acesso.obra(obra)) throw erro(403, 'Você não tem acesso a esta obra.');
    return { obra, mes };
  };

  rotas.adicionar('GET', '/api/comentarios-telas', { permissao: 'editarConteudo' }, async ({ req, res, url, acesso }) => {
    const { obra, mes } = obraEMes(url, acesso);
    enviarJson(req, res, 200, { comentarios: await ler(obra, mes) });
  });

  rotas.adicionar('POST', '/api/comentarios-telas', { permissao: 'administrar' }, async ({ req, res, usuario, acesso }) => {
    let dados;
    try {
      dados = validarComentario(await lerJson(req));
    } catch (e) {
      throw erro(400, e.message);
    }
    if (!acesso.obra(dados.obra)) throw erro(403, 'Você não tem acesso a esta obra.');
    const comentario = {
      id: randomUUID(), tela: dados.tela, visao: dados.visao, texto: dados.texto,
      autor: usuario.nome, email: usuario.email, criadoEm: new Date().toISOString(),
    };
    await gravar(dados.obra, dados.mes, [...(await ler(dados.obra, dados.mes)), comentario]);
    enviarJson(req, res, 201, comentario);
  });

  rotas.adicionar('DELETE', '/api/comentarios-telas/:id', { permissao: 'administrar' }, async ({ req, res, url, params, acesso }) => {
    const { obra, mes } = obraEMes(url, acesso);
    const lista = await ler(obra, mes);
    if (!lista.some((c) => c.id === params.id)) throw erro(404, 'Comentário não encontrado.');
    await gravar(obra, mes, lista.filter((c) => c.id !== params.id));
    enviarJson(req, res, 200, { ok: true });
  });
}
