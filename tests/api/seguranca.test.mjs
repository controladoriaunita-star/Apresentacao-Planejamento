/**
 * Contrato da Segurança do Trabalho (/api/seguranca/…) nos dois armazenamentos: arquivos locais e Supabase
 * simulado (filtros in/gte/lte/ilike, paginação com Content-Range, inserção em lote e chave única).
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { cliente, subirServidor } from './servidor.mjs';

for (const store of ['local', 'supabase']) {
  describe(`segurança do trabalho (${store})`, () => {
    let srv;
    let dev;
    let anonimo;
    let obra;
    let outra;

    const acidente = (campos = {}) => ({
      data: '2025-02-06', obraId: obra.id, faseObra: 'Estrutura', nomeAcidentado: 'Arlindo Vitor', funcao: 'Líder de Obras',
      empresa: 'Tr Materiais', tipo: 'CPT', parteCorpo: 'Punho', diasAfastamento: 7, resumo: 'Prensou o punho contra a parede.', ...campos,
    });
    const linha = (campos = {}) => ({
      'Data do Acidente': '2025-10-13', 'Nome da Obra': 'Obra Teste', 'Fase da Obra': 'Estrutura', 'Nome do Acidentado': 'Evair de Santana Castro',
      Função: 'Op de Betoneira', 'Nome da Empresa': 'Rocha Construções', Tipo: 'CPT', 'Parte do Corpo Atingida': 'Braço', 'Dias Afastamento': 3,
      'Resumo do Acidente': 'Fragmento de concreto atingiu o braço.', __linha: 2, ...campos,
    });

    before(async () => {
      srv = await subirServidor({ store });
      dev = cliente(srv.base, srv.fetchExterno);
      anonimo = cliente(srv.base, srv.fetchExterno);
      assert.equal((await dev('POST', '/api/auth/configurar', { nome: 'Dev', email: 'dev@unita.com.br', senha: 'senha-forte-1' })).status, 201);
      obra = (await dev('PUT', '/api/obras/cadastro', { obra: 'Obra Teste', cliente: 'Incorporadora X', sistemaEstrutural: 'Parede de Concreto' })).dados;
      outra = (await dev('PUT', '/api/obras/cadastro', { obra: 'Obra Sem Sistema', cliente: 'Incorporadora Y' })).dados;
    });
    after(() => srv.fechar());

    test('exige login e só aceita obra completa do Cadastro de obras', async () => {
      assert.equal((await anonimo('GET', '/api/seguranca/acidentes')).status, 401);
      let r = await dev('POST', '/api/seguranca/acidentes', acidente({ obraId: outra.id }));
      assert.equal(r.status, 400);
      assert.match(r.dados.erro, /Sistema estrutural/);
      r = await dev('POST', '/api/seguranca/acidentes', acidente({ obraId: 'nao-existe' }));
      assert.equal(r.status, 400);
      r = await dev('POST', '/api/seguranca/acidentes', acidente({ tipo: 'XX', diasAfastamento: -1 }));
      assert.equal(r.status, 400);
    });

    test('cadastro manual: grava, junta Incorporador/Método do cadastro e recusa duplicado', async () => {
      const r = await dev('POST', '/api/seguranca/acidentes', acidente());
      assert.equal(r.status, 201, JSON.stringify(r.dados));
      assert.equal(r.dados.incorporador, 'Incorporadora X');
      assert.equal(r.dados.metodoConstrutivo, 'Parede de Concreto');
      assert.equal(r.dados.chaveDedup, undefined);
      assert.equal((await dev('POST', '/api/seguranca/acidentes', acidente({ diasAfastamento: 30 }))).status, 409);
      if (store === 'supabase') {
        const salvo = srv.supabase.tabelas.get('acidentes')[0];
        assert.equal(salvo.obra_id, obra.id);
        assert.equal(salvo.incorporador, undefined, 'incorporador não é copiado para o acidente');
      }
    });

    test('importação: analisa sem gravar, importa só os novos e não duplica na segunda vez', async () => {
      const linhas = [
        linha(),
        linha({ 'Nome do Acidentado': 'Jorgeilson Santos de Jesus', 'Data do Acidente': '2026-04-09', __linha: 3 }),
        linha({ __linha: 4 }), // repetida na própria planilha
        linha({ 'Nome da Obra': 'MC Desconhecida', __linha: 5 }),
        linha({ 'Data do Acidente': '2025-02-06', 'Nome do Acidentado': 'Arlindo Vitor', Função: 'Líder de Obras', 'Nome da Empresa': 'Tr Materiais', 'Parte do Corpo Atingida': 'Punho', __linha: 6 }),
      ];
      let r = await dev('POST', '/api/seguranca/importacao/analisar', { linhas });
      assert.equal(r.status, 200);
      assert.deepEqual(r.dados.totais, { lidas: 5, novos: 2, existentes: 1, repetidos: 1, erros: 1 });
      assert.equal((await dev('GET', '/api/seguranca/acidentes')).dados.total, 1, 'analisar não grava');

      r = await dev('POST', '/api/seguranca/importacao', { linhas });
      assert.equal(r.status, 200);
      assert.equal(r.dados.importados, 2);
      assert.equal(r.dados.comErro, 1);
      assert.deepEqual(r.dados.erros.map((e) => e.linha), [5]);

      r = await dev('POST', '/api/seguranca/importacao', { linhas, mapaObras: { 'mc desconhecida': obra.id } });
      assert.equal(r.dados.importados, 0, 'planilha acumulativa: nada entra de novo');
      assert.equal(r.dados.jaExistentes, 5, 'todas as linhas, inclusive a obra associada pelo de-para, já estão gravadas');
      assert.equal((await dev('GET', '/api/seguranca/acidentes')).dados.total, 3);
    });

    test('tabela histórica: filtros, pesquisa, ordenação e paginação', async () => {
      let r = await dev('GET', '/api/seguranca/acidentes?ordem=asc&tamanho=2&pagina=1');
      assert.deepEqual([r.dados.total, r.dados.itens.length], [3, 2]);
      assert.equal(r.dados.itens[0].data, '2025-02-06');
      r = await dev('GET', '/api/seguranca/acidentes?ordem=asc&tamanho=2&pagina=2');
      assert.deepEqual(r.dados.itens.map((a) => a.data), ['2026-04-09']);
      r = await dev('GET', '/api/seguranca/acidentes?de=2025-06-01&ate=2025-12-31');
      assert.deepEqual(r.dados.itens.map((a) => a.nomeAcidentado), ['Evair de Santana Castro']);
      r = await dev('GET', '/api/seguranca/acidentes?nome=jorge');
      assert.equal(r.dados.total, 1);
      r = await dev('GET', '/api/seguranca/acidentes?empresa=rocha&tipos=SPT');
      assert.equal(r.dados.total, 0);
      r = await dev('GET', `/api/seguranca/acidentes?chaves=${encodeURIComponent('obra sem sistema')}`);
      assert.equal(r.dados.total, 0);
      r = await dev('GET', `/api/seguranca/acidentes?obras=${obra.id}&tamanho=todos`);
      assert.equal(r.dados.itens.length, 3);
    });

    test('indicadores do dashboard e segmentador de ano', async () => {
      let r = await dev('GET', `/api/seguranca/indicadores?chaves=${encodeURIComponent('obra teste')}`);
      assert.equal(r.status, 200);
      assert.deepEqual(r.dados.anosDisponiveis, ['2025', '2026']);
      assert.equal(r.dados.indicadores.total, 3);
      assert.equal(r.dados.indicadores.porTipo.find((t) => t.rotulo === 'CPT').valor, 3);
      assert.deepEqual(r.dados.indicadores.porObra, [{ rotulo: 'Obra Teste', valor: 3 }]);
      r = await dev('GET', '/api/seguranca/indicadores?anos=2026');
      assert.equal(r.dados.indicadores.total, 1);
    });

    test('editar e excluir refletem nos indicadores; cadastro com acidentes não é excluído', async () => {
      assert.equal((await dev('DELETE', `/api/obras/cadastro/${obra.id}`)).status, 409);
      const [primeiro] = (await dev('GET', '/api/seguranca/acidentes?ordem=asc')).dados.itens;
      let r = await dev('PUT', `/api/seguranca/acidentes/${primeiro.id}`, { tipo: 'SPT', diasAfastamento: 0 });
      assert.equal(r.status, 200, JSON.stringify(r.dados));
      assert.equal(r.dados.tipo, 'SPT');
      r = await dev('GET', '/api/seguranca/indicadores');
      assert.equal(r.dados.indicadores.porTipo.find((t) => t.rotulo === 'SPT').valor, 1);
      assert.equal((await dev('DELETE', `/api/seguranca/acidentes/${primeiro.id}`)).status, 200);
      assert.equal((await dev('GET', '/api/seguranca/indicadores')).dados.indicadores.total, 2);
    });

    test('papel Segurança: só acidentes, indicadores e obras resumidas; nada das apresentações', async () => {
      const email = 'seg@unita.com.br';
      const senha = 'senha-forte-3';
      const seg = cliente(srv.base, srv.fetchExterno);
      if (store === 'local') {
        assert.equal((await dev('POST', '/api/usuarios', { nome: 'Seg', email, papel: 'seguranca', senha })).status, 201);
        assert.equal((await seg('POST', '/api/auth/login', { email, senha })).status, 200);
      } else {
        assert.equal((await dev('POST', '/api/usuarios', { nome: 'Seg', email, papel: 'seguranca' })).status, 201);
        const convite = srv.supabase.emails.at(-1);
        const r = await seg('POST', '/api/auth/definir-senha', { token: convite.token, senha });
        assert.equal(r.status, 200, JSON.stringify(r.dados));
        assert.equal(r.dados.usuario.papel, 'seguranca');
      }

      // Pode: obras resumidas (sem orçamento), acidentes, indicadores, cadastrar acidente e trocar a própria senha.
      let r = await seg('GET', '/api/seguranca/obras');
      assert.equal(r.status, 200);
      assert.deepEqual(Object.keys(r.dados[0]).sort(), ['chave', 'cliente', 'id', 'obra', 'sistemaEstrutural']);
      assert.equal((await seg('GET', '/api/seguranca/acidentes')).status, 200);
      assert.equal((await seg('GET', '/api/seguranca/indicadores')).status, 200);
      r = await seg('POST', '/api/seguranca/acidentes', acidente({ nomeAcidentado: 'Fulano da Segurança', data: '2026-03-02' }));
      assert.equal(r.status, 201, JSON.stringify(r.dados));
      assert.equal((await seg('POST', '/api/seguranca/importacao/analisar', { linhas: [] })).status, 200);
      assert.equal((await seg('DELETE', `/api/seguranca/acidentes/${r.dados.id}`)).status, 200);
      if (store === 'local') assert.equal((await seg('PUT', '/api/auth/senha', { senhaAtual: senha, novaSenha: 'senha-forte-4' })).status, 200);

      // Não pode: dados das apresentações, cadastro de obras, conteúdo, usuários.
      for (const [metodo, caminho, corpo] of [
        ['GET', '/api/dados/resumo'], ['GET', '/api/obras/cadastro'], ['GET', '/api/telas'], ['GET', '/api/midias'], ['GET', '/api/incc'],
        ['PUT', '/api/obras/cadastro', { obra: 'X' }], ['POST', '/api/arquivos/envio', { nome: 'a.png', tipo: 'image/png', tamanho: 10 }],
        ['GET', '/api/usuarios'],
      ]) {
        assert.equal((await seg(metodo, caminho, corpo)).status, 403, `${metodo} ${caminho}`);
      }

      // Viewer continua lendo os acidentes (aba da apresentação), mas não grava nem lista as obras resumidas.
      const ver = cliente(srv.base, srv.fetchExterno);
      if (store === 'local') {
        await dev('POST', '/api/usuarios', { nome: 'Ver', email: 'ver-seg@unita.com.br', papel: 'viewer', senha });
        assert.equal((await ver('POST', '/api/auth/login', { email: 'ver-seg@unita.com.br', senha })).status, 200);
        assert.equal((await ver('GET', '/api/seguranca/acidentes')).status, 200);
        assert.equal((await ver('GET', '/api/seguranca/obras')).status, 403);
        assert.equal((await ver('POST', '/api/seguranca/acidentes', acidente())).status, 403);
      }
    });
  });
}
