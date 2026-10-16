/**
 * Dados das apresentações: planilhas do SharePoint (cruas, em matriz), cadastro de obras e INCC.
 * O servidor não calcula medidas — os cálculos ficam em public/js/domain (testados e reaproveitados),
 * o que mantém este backend fino e fácil de reescrever em PHP.
 */
import { ABAS } from '../../public/js/domain/colunas.js';
import { cadastrosDePlanilha, normalizarCadastro } from '../../public/js/domain/cadastro-obra.js';
import { enviarJson, erro, lerJson } from '../http/respostas.mjs';

export function registrarDados(rotas, { planilhas, incc, cadastro, config }) {
  rotas.adicionar('GET', '/api/dados/resumo', { permissao: 'ver' }, async ({ req, res }) => {
    incc.atualizar().catch(() => {}); // segundo plano, no máximo 1× por dia
    const [infos, orc, econ] = await Promise.all([
      planilhas.aba(ABAS.infosGerais), planilhas.aba(ABAS.orcamento), planilhas.aba(ABAS.economico),
    ]);
    enviarJson(req, res, 200, {
      fonte: planilhas.descricao,
      aviso: planilhas.aviso,
      atualizadoEm: [infos.lidoEm, orc.lidoEm, econ.lidoEm].sort()[0],
      abas: {
        [ABAS.infosGerais]: semData(infos),
        [ABAS.orcamento]: semData(orc),
        [ABAS.economico]: semData(econ),
      },
      cadastro: await cadastro.listar(),
      incc: (await incc.listar()).itens.map(({ mes, indice }) => ({ mes, indice })),
    });
  });

  rotas.adicionar('GET', '/api/dados/fisico', { permissao: 'ver' }, async ({ req, res, url }) => {
    const obra = url.searchParams.get('obra');
    if (!obra) throw erro(400, 'Informe a obra.');
    enviarJson(req, res, 200, semData(await planilhas.fisicoDaObra(obra)));
  });

  rotas.adicionar('POST', '/api/dados/atualizar', { permissao: 'editarConteudo' }, async ({ req, res }) => {
    await planilhas.atualizarTudo();
    enviarJson(req, res, 200, { ok: true, aviso: planilhas.aviso });
  });

  rotas.adicionar('GET', '/api/incc', { permissao: 'ver' }, async ({ req, res }) => {
    enviarJson(req, res, 200, await incc.listar());
  });

  rotas.adicionar('POST', '/api/incc/atualizar', { permissao: 'editarConteudo' }, async ({ req, res }) => {
    try {
      const { novos } = await incc.atualizar({ forcar: true });
      enviarJson(req, res, 200, { novos, ...(await incc.listar()) });
    } catch (e) {
      throw erro(502, `Não foi possível consultar o Banco Central: ${e.message}`);
    }
  });

  rotas.adicionar('PUT', '/api/incc/:mes', { permissao: 'editarConteudo' }, async ({ req, res, params }) => {
    const { indice } = await lerJson(req);
    if (!/^\d{4}-\d{2}$/.test(params.mes) || !(Number(indice) > 0)) throw erro(400, 'Informe o mês (AAAA-MM) e um índice maior que zero.');
    await incc.definirManual(params.mes, Number(indice));
    enviarJson(req, res, 200, await incc.listar());
  });

  // ── Cadastro de obras ────────────────────────────────────────────────
  rotas.adicionar('GET', '/api/obras/cadastro', { permissao: 'ver' }, async ({ req, res }) => {
    enviarJson(req, res, 200, await cadastro.listar());
  });

  rotas.adicionar('PUT', '/api/obras/cadastro', { permissao: 'editarConteudo' }, async ({ req, res, usuario }) => {
    let registro;
    try {
      registro = normalizarCadastro(await lerJson(req));
    } catch (e) {
      throw erro(400, e.message);
    }
    const salvo = await cadastro.upsertPor('chave', { ...registro, atualizadoPor: usuario.email });
    enviarJson(req, res, 200, salvo);
  });

  /** Importação: corpo = linhas da planilha "Painel de Obras" já lidas no navegador (objetos por cabeçalho). */
  rotas.adicionar('POST', '/api/obras/cadastro/importar', { permissao: 'editarConteudo' }, async ({ req, res, usuario }) => {
    const { linhas } = await lerJson(req, 10 * 1024 * 1024);
    if (!Array.isArray(linhas)) throw erro(400, 'Envie as linhas da planilha.');
    const registros = cadastrosDePlanilha(linhas);
    for (const r of registros) await cadastro.upsertPor('chave', { ...r, atualizadoPor: usuario.email });
    enviarJson(req, res, 200, { importados: registros.length, obras: registros.map((r) => r.obra) });
  });

  rotas.adicionar('DELETE', '/api/obras/cadastro/:id', { permissao: 'editarConteudo' }, async ({ req, res, params }) => {
    if (!(await cadastro.remover(params.id))) throw erro(404, 'Cadastro não encontrado.');
    enviarJson(req, res, 200, { ok: true });
  });

  rotas.adicionar('GET', '/api/saude', { permissao: null }, async ({ req, res }) => {
    enviarJson(req, res, 200, {
      ok: true, fonte: config.fonteDados, armazenamento: config.store, login: config.semLogin ? 'desligado' : 'obrigatorio',
    });
  });
}

const semData = ({ colunas, linhas }) => ({ colunas, linhas });
