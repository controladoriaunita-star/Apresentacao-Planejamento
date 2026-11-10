/**
 * Segurança do Trabalho: acidentes por obra (cadastro manual, importação da planilha acumulativa, tabela
 * histórica) e indicadores dos dashboards. Regras em public/js/domain/seguranca.js (as mesmas do navegador).
 *
 * Incorporador e Método construtivo saem sempre do Cadastro de obras (Cliente e Sistema estrutural),
 * juntados aqui pelo `obraId` — o acidente não guarda cópia.
 */
import { podeVerSeguranca } from '../../public/js/domain/acesso.js';
import {
  analisarImportacao, anosDosAcidentes, calcularIndicadores, dadosDaObra, pendenciasDaObra, SIGLAS_TIPO, validarAcidente,
} from '../../public/js/domain/seguranca.js';
import { enviarJson, erro, lerJson } from '../http/respostas.mjs';
import { ErroDuplicado } from '../store/acidentes.mjs';

const TAMANHO_PAGINA = 50;
const TAMANHO_MAXIMO = 200;
const LIMITE_APRESENTACAO = 5000; // abas da apresentação: todos os acidentes das obras filtradas
const LIMITE_LINHAS_IMPORTACAO = 20000;
const MENSAGEM_DUPLICADO = 'Já existe um acidente com a mesma data, obra, acidentado, tipo, parte do corpo, função e empresa.';

const lista = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const dataOuNada = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? v : null);

export function registrarSeguranca(rotas, { acidentes, cadastro }) {
  const cadastros = async () => (await cadastro.listar()).filter((c) => c.id);

  /** Obras pedidas por id do cadastro (`obras`) ou por chave do filtro das apresentações (`chaves`). */
  function obrasDoFiltro(url, todas, acesso) {
    if (url.searchParams.has('obras')) {
      const ids = new Set(lista(url.searchParams.get('obras')));
      return todas.filter((c) => ids.has(c.id)).map((c) => c.id);
    }
    if (url.searchParams.has('chaves')) {
      const chaves = new Set(lista(url.searchParams.get('chaves')));
      return todas.filter((c) => chaves.has(c.chave)).map((c) => c.id);
    }
    return acesso.restrito ? todas.map((c) => c.id) : null; // todas (as liberadas)
  }

  /** v26: obras cujos acidentes o usuário pode ler (todas, salvo Viewer restrito por obra ou só com o Cliente). */
  const cadastrosLiberados = async (acesso) => (await cadastros()).filter((c) => !acesso.restrito || podeVerSeguranca(c, acesso));

  const comObra = (porId) => ({ chaveDedup, ...a }) => ({ ...a, ...dadosDaObra(porId.get(a.obraId)) });

  rotas.adicionar('GET', '/api/seguranca/acidentes', { permissao: 'verSeguranca' }, async ({ req, res, url, acesso }) => {
    const todas = await cadastrosLiberados(acesso);
    const p = url.searchParams;
    const todos = p.get('tamanho') === 'todos';
    const tamanho = todos ? LIMITE_APRESENTACAO : Math.min(TAMANHO_MAXIMO, Math.max(1, Number(p.get('tamanho')) || TAMANHO_PAGINA));
    const pagina = todos ? 1 : Math.max(1, Number(p.get('pagina')) || 1);
    const { itens, total } = await acidentes.consultar({
      obraIds: obrasDoFiltro(url, todas, acesso),
      de: dataOuNada(p.get('de')),
      ate: dataOuNada(p.get('ate')),
      tipos: lista(p.get('tipos')).filter((t) => SIGLAS_TIPO.includes(t)),
      nome: p.get('nome')?.trim() || null,
      empresa: p.get('empresa')?.trim() || null,
      ordem: p.get('ordem') === 'asc' ? 'asc' : 'desc',
      limite: tamanho,
      deslocamento: (pagina - 1) * tamanho,
    });
    enviarJson(req, res, 200, { itens: itens.map(comObra(new Map(todas.map((c) => [c.id, c])))), total, pagina, tamanho });
  });

  /**
   * Obras do Cadastro de obras só com o que a Segurança do Trabalho usa — para o papel Segurança, que não
   * carrega os dados das apresentações (orçamentos, curvas etc.).
   */
  rotas.adicionar('GET', '/api/seguranca/obras', { permissao: 'editarSeguranca' }, async ({ req, res }) => {
    const obras = (await cadastros()).map(({ id, chave, obra, cliente, sistemaEstrutural }) => ({
      id, chave, obra, cliente: cliente ?? null, sistemaEstrutural: sistemaEstrutural ?? null,
    }));
    enviarJson(req, res, 200, obras);
  });

  /** Indicadores do Dashboard Segurança. `anos` = segmentador de ano (vazio = todos). */
  rotas.adicionar('GET', '/api/seguranca/indicadores', { permissao: 'verSeguranca' }, async ({ req, res, url, acesso }) => {
    const todas = await cadastrosLiberados(acesso);
    const porId = new Map(todas.map((c) => [c.id, c]));
    const { itens } = await acidentes.consultar({
      obraIds: obrasDoFiltro(url, todas, acesso),
      ordem: 'asc',
      campos: ['obraId', 'data', 'tipo', 'faseObra', 'funcao', 'empresa', 'parteCorpo', 'diasAfastamento'],
    });
    const anosDisponiveis = anosDosAcidentes(itens);
    const anos = new Set(lista(url.searchParams.get('anos')));
    const considerados = itens
      .filter((a) => !anos.size || anos.has(a.data.slice(0, 4)))
      .map((a) => ({ ...a, obra: porId.get(a.obraId)?.obra ?? null }));
    enviarJson(req, res, 200, { anosDisponiveis, anos: [...anos].filter((a) => anosDisponiveis.includes(a)), indicadores: calcularIndicadores(considerados) });
  });

  async function validarComObra(entrada) {
    const { acidente, erros } = validarAcidente(entrada);
    if (!acidente) throw erro(400, erros.join(' '));
    const obra = await cadastro.obter(acidente.obraId);
    if (!obra) throw erro(400, 'A obra precisa existir no Cadastro de obras.');
    const faltam = pendenciasDaObra(obra);
    if (faltam.length) throw erro(400, `Complete no Cadastro de obras de ${obra.obra}: ${faltam.join(' e ')}.`);
    return { acidente, obra };
  }

  rotas.adicionar('POST', '/api/seguranca/acidentes', { permissao: 'editarSeguranca' }, async ({ req, res, usuario }) => {
    const { acidente, obra } = await validarComObra(await lerJson(req));
    try {
      const salvo = await acidentes.inserir({ ...acidente, origem: 'manual', criadoPor: usuario.email });
      enviarJson(req, res, 201, comObra(new Map([[obra.id, obra]]))(salvo));
    } catch (e) {
      if (e instanceof ErroDuplicado) throw erro(409, MENSAGEM_DUPLICADO);
      throw e;
    }
  });

  rotas.adicionar('PUT', '/api/seguranca/acidentes/:id', { permissao: 'editarSeguranca' }, async ({ req, res, params, usuario }) => {
    const atual = await acidentes.obter(params.id);
    if (!atual) throw erro(404, 'Acidente não encontrado.');
    const { acidente, obra } = await validarComObra({ ...atual, ...(await lerJson(req)) });
    try {
      const salvo = await acidentes.atualizar(params.id, { ...acidente, atualizadoPor: usuario.email });
      enviarJson(req, res, 200, comObra(new Map([[obra.id, obra]]))(salvo));
    } catch (e) {
      if (e instanceof ErroDuplicado) throw erro(409, MENSAGEM_DUPLICADO);
      throw e;
    }
  });

  rotas.adicionar('DELETE', '/api/seguranca/acidentes/:id', { permissao: 'editarSeguranca' }, async ({ req, res, params }) => {
    if (!(await acidentes.remover(params.id))) throw erro(404, 'Acidente não encontrado.');
    enviarJson(req, res, 200, { ok: true });
  });

  // ── Importação da planilha (linhas já lidas no navegador, como no Cadastro de obras) ──
  async function analisar(req) {
    const { linhas, mapaObras } = await lerJson(req, 15 * 1024 * 1024);
    if (!Array.isArray(linhas)) throw erro(400, 'Envie as linhas da planilha.');
    if (linhas.length > LIMITE_LINHAS_IMPORTACAO) throw erro(413, `Planilha com mais de ${LIMITE_LINHAS_IMPORTACAO} linhas.`);
    const todas = await cadastros();
    // Pré-análise sem os existentes só para descobrir as chaves; depois busca no banco apenas essas.
    const previa = analisarImportacao(linhas, todas, new Map(), { mapaObras: mapaObras ?? {} });
    const chaves = previa.linhas.filter((l) => l.acidente).map((l) => l.acidente.chaveDedup);
    const existentes = await acidentes.porChaves([...new Set(chaves)]);
    return analisarImportacao(linhas, todas, existentes, { mapaObras: mapaObras ?? {} });
  }

  rotas.adicionar('POST', '/api/seguranca/importacao/analisar', { permissao: 'editarSeguranca' }, async ({ req, res }) => {
    enviarJson(req, res, 200, await analisar(req));
  });

  /** Grava só as linhas novas e válidas, num único comando; as demais voltam no relatório. */
  rotas.adicionar('POST', '/api/seguranca/importacao', { permissao: 'editarSeguranca' }, async ({ req, res, usuario }) => {
    const analise = await analisar(req);
    const novos = analise.linhas.filter((l) => l.situacao === 'novo').map((l) => ({ ...l.acidente, origem: 'importacao', criadoPor: usuario.email }));
    const inseridos = await acidentes.inserirVarios(novos);
    enviarJson(req, res, 200, {
      importados: inseridos.length,
      jaExistentes: analise.totais.existentes + (novos.length - inseridos.length),
      repetidos: analise.totais.repetidos,
      comErro: analise.totais.erros,
      erros: analise.linhas.filter((l) => l.situacao === 'erro').map(({ linha, erros }) => ({ linha, erros })),
    });
  });
}
