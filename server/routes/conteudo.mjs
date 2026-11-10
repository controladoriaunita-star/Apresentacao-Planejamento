/**
 * Conteúdo cadastrado pelo Planejamento: arquivos, mídias (TxC/fotos) e telas do cliente.
 *
 * Envio de arquivo em dois passos (mesmo contrato nos dois modos de armazenamento):
 *   1. POST /api/arquivos/envio {nome, tipo, tamanho} → { arquivo?, envio: { modo, url, metodo, cabecalhos } }
 *   2. modo "direto": o navegador envia ao Storage pela URL assinada e usa `arquivo.id`;
 *      modo "servidor": o navegador envia o corpo cru para POST /api/arquivos.
 */
import { podeVerMidia, podeVerTela } from '../../public/js/domain/acesso.js';
import { normalizarMidia, normalizarTela } from '../../public/js/domain/conteudo.js';
import { enviarBinario, enviarJson, erro, lerCorpo, lerJson } from '../http/respostas.mjs';
import { TIPOS_ACEITOS } from '../store/arquivos.mjs';

const MENSAGEM_TIPO = 'Tipo de arquivo não aceito. Envie imagem (PNG, JPG, WEBP, GIF — o app converte os demais formatos), PDF ou planilha (XLSX, XLS, CSV).';
const nomeSeguro = (nome) => String(nome ?? 'arquivo').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 180);

export function registrarConteudo(rotas, { arquivos, midias, telas, config }) {
  const limite = config.limiteUploadMB * 1024 * 1024;

  rotas.adicionar('POST', '/api/arquivos/envio', { permissao: 'editarConteudo' }, async ({ req, res, usuario }) => {
    const { nome, tipo, tamanho } = await lerJson(req);
    if (!TIPOS_ACEITOS[tipo]) throw erro(415, MENSAGEM_TIPO);
    if (!(Number(tamanho) > 0)) throw erro(400, 'Arquivo vazio.');
    if (Number(tamanho) > limite) throw erro(413, `Arquivo maior que o limite de ${config.limiteUploadMB} MB.`);
    const { registro, envio } = await arquivos.prepararEnvio({ nome: nomeSeguro(nome), tipo, tamanho: Number(tamanho), usuario: usuario.email });
    enviarJson(req, res, 200, { arquivo: registro ?? null, envio });
  });

  // Envio pelo servidor: corpo binário cru (portável para PHP com php://input).
  rotas.adicionar('POST', '/api/arquivos', { permissao: 'editarConteudo' }, async ({ req, res, usuario }) => {
    const tipo = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!TIPOS_ACEITOS[tipo]) throw erro(415, MENSAGEM_TIPO);
    const nome = nomeSeguro(decodeURIComponent(String(req.headers['x-nome-arquivo'] ?? 'arquivo')));
    const dados = await lerCorpo(req, limite);
    if (!dados.length) throw erro(400, 'Arquivo vazio.');
    enviarJson(req, res, 201, await arquivos.salvar({ nome, tipo, dados, usuario: usuario.email }));
  });

  /** v26: usuário restrito só baixa arquivo de mídia ou tela que ele pode ver. */
  async function arquivoLiberado(id, acesso) {
    if (!acesso.restrito) return true;
    if ((await midias.listar()).some((m) => m.arquivoId === id && podeVerMidia(m, acesso))) return true;
    return (await telas.listar()).some((t) => t.ativa !== false && podeVerTela(t, acesso) && t.blocos.some((b) => b.arquivoId === id));
  }

  rotas.adicionar('GET', '/api/arquivos/:id', { permissao: 'ver' }, async ({ res, params, acesso }) => {
    if (!(await arquivoLiberado(params.id, acesso))) throw erro(404, 'Arquivo não encontrado.');
    const arquivo = await arquivos.ler(params.id).catch(() => null);
    if (!arquivo) throw erro(404, 'Arquivo não encontrado.');
    if (arquivo.redirecionar) {
      res.writeHead(302, { location: arquivo.redirecionar, 'cache-control': 'private, max-age=600' });
      return res.end();
    }
    const { registro, dados } = arquivo;
    enviarBinario(res, 200, dados, registro.tipo, {
      'cache-control': 'private, max-age=86400',
      'content-disposition': `${registro.categoria === 'imagem' || registro.categoria === 'pdf' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(registro.nome)}`,
    });
  });

  /** Descarta um arquivo cujo envio direto falhou (ou que não chegou a ser usado). */
  rotas.adicionar('DELETE', '/api/arquivos/:id', { permissao: 'editarConteudo' }, async ({ req, res, params }) => {
    await arquivos.remover(params.id);
    enviarJson(req, res, 200, { ok: true });
  });

  // ── Mídias (TxC e fotos) ──
  rotas.adicionar('GET', '/api/midias', { permissao: 'ver' }, async ({ req, res, url, acesso }) => {
    const filtro = Object.fromEntries(['tipo', 'chaveObra', 'mes'].map((k) => [k, url.searchParams.get(k)]).filter(([, v]) => v));
    const lista = (await midias.listar())
      .filter((m) => Object.entries(filtro).every(([k, v]) => m[k] === v) && (!acesso.restrito || podeVerMidia(m, acesso)))
      .sort((a, b) => b.mes.localeCompare(a.mes) || a.ordem - b.ordem);
    enviarJson(req, res, 200, lista);
  });

  rotas.adicionar('POST', '/api/midias', { permissao: 'editarConteudo' }, async ({ req, res, usuario }) => {
    const dados = validar(normalizarMidia, await lerJson(req));
    enviarJson(req, res, 201, await midias.inserir({ ...dados, criadoPor: usuario.email }));
  });

  rotas.adicionar('PUT', '/api/midias/:id', { permissao: 'editarConteudo' }, async ({ req, res, params, usuario }) => {
    const atual = await midias.obter(params.id);
    if (!atual) throw erro(404, 'Mídia não encontrada.');
    const dados = validar(normalizarMidia, { ...atual, ...(await lerJson(req)) });
    const atualizada = await midias.atualizar(params.id, { ...dados, atualizadoPor: usuario.email });
    if (dados.arquivoId !== atual.arquivoId) await arquivos.remover(atual.arquivoId); // imagem substituída
    enviarJson(req, res, 200, atualizada);
  });

  rotas.adicionar('DELETE', '/api/midias/:id', { permissao: 'editarConteudo' }, async ({ req, res, params }) => {
    const removida = await midias.remover(params.id);
    if (!removida) throw erro(404, 'Mídia não encontrada.');
    await arquivos.remover(removida.arquivoId);
    enviarJson(req, res, 200, { ok: true });
  });

  // ── Telas da apresentação Cliente ──
  rotas.adicionar('GET', '/api/telas', { permissao: 'ver' }, async ({ req, res, acesso }) => {
    let lista = await telas.listar();
    // v26: usuário restrito só recebe as telas ativas que pode ver, sem os nomes das obras não liberadas.
    if (acesso.restrito) {
      lista = lista.filter((t) => t.ativa !== false && podeVerTela(t, acesso)).map((t) => ({ ...t, obras: t.obras.filter((o) => acesso.obra(o)) }));
    }
    enviarJson(req, res, 200, lista.sort((a, b) => a.ordem - b.ordem));
  });

  rotas.adicionar('POST', '/api/telas', { permissao: 'editarConteudo' }, async ({ req, res, usuario }) => {
    const dados = validar(normalizarTela, await lerJson(req));
    enviarJson(req, res, 201, await telas.inserir({ ...dados, criadoPor: usuario.email }));
  });

  rotas.adicionar('PUT', '/api/telas/:id', { permissao: 'editarConteudo' }, async ({ req, res, params, usuario }) => {
    const atual = await telas.obter(params.id);
    if (!atual) throw erro(404, 'Tela não encontrada.');
    const dados = validar(normalizarTela, await lerJson(req));
    const atualizada = await telas.atualizar(params.id, { ...dados, atualizadoPor: usuario.email });
    // Arquivos que saíram da tela são apagados.
    const mantidos = new Set(dados.blocos.map((b) => b.arquivoId).filter(Boolean));
    for (const b of atual.blocos) if (b.arquivoId && !mantidos.has(b.arquivoId)) await arquivos.remover(b.arquivoId);
    enviarJson(req, res, 200, atualizada);
  });

  rotas.adicionar('DELETE', '/api/telas/:id', { permissao: 'editarConteudo' }, async ({ req, res, params }) => {
    const removida = await telas.remover(params.id);
    if (!removida) throw erro(404, 'Tela não encontrada.');
    for (const b of removida.blocos) if (b.arquivoId) await arquivos.remover(b.arquivoId);
    enviarJson(req, res, 200, { ok: true });
  });
}

function validar(normalizar, entrada) {
  try {
    return normalizar(entrada);
  } catch (e) {
    throw erro(400, e.message);
  }
}
