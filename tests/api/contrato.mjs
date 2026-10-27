/**
 * Regressão do contrato REST (docs/API.md), executada nos dois armazenamentos:
 * contrato-local.test.mjs (arquivos JSON) e contrato-supabase.test.mjs (Supabase simulado).
 * A futura versão PHP deve passar nestes mesmos cenários.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { cliente, enviarArquivo, subirServidor } from './servidor.mjs';

export function suiteContrato(store) {
describe(`contrato REST (${store})`, () => {

let srv;
let dev;
let planejamento;
let viewer;
let anonimo;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

before(async () => {
  srv = await subirServidor({ store });
  dev = cliente(srv.base, srv.fetchExterno);
  planejamento = cliente(srv.base, srv.fetchExterno);
  viewer = cliente(srv.base, srv.fetchExterno);
  anonimo = cliente(srv.base, srv.fetchExterno);
});
after(() => srv.fechar());

test('primeiro acesso cria o Dev e depois fica bloqueado', async () => {
  let r = await anonimo('GET', '/api/auth/sessao');
  assert.deepEqual(r.dados, { usuario: null, precisaConfigurar: true });

  r = await dev('POST', '/api/auth/configurar', { nome: 'Lucas', email: 'Lucas@Unita.com.br', senha: 'senha-forte-1' });
  assert.equal(r.status, 201);
  assert.equal(r.dados.usuario.papel, 'dev');
  assert.equal(r.dados.usuario.email, 'lucas@unita.com.br');
  assert.equal(r.dados.usuario.senhaHash, undefined, 'hash nunca sai na API');

  r = await anonimo('POST', '/api/auth/configurar', { nome: 'Outro', email: 'x@y.com', senha: 'senha-forte-1' });
  assert.equal(r.status, 409);
  if (store === 'supabase') {
    assert.equal(srv.supabase.usuarios.size, 1, 'usuário criado no Supabase Auth');
    assert.equal(srv.supabase.tabelas.get('perfis')?.[0]?.papel, 'dev', 'papel na tabela perfis');
  }
});

test('dev cria usuários de Planejamento e Viewer; login e erros', async () => {
  for (const [email, papel] of [['plan@unita.com.br', 'planejamento'], ['ver@unita.com.br', 'viewer']]) {
    const r = await dev('POST', '/api/usuarios', { nome: papel, email, papel, senha: 'senha-forte-2' });
    assert.equal(r.status, 201, JSON.stringify(r.dados));
  }
  assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'ver@unita.com.br', papel: 'viewer', senha: 'senha-forte-2' })).status, 409);
  assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'z@unita.com.br', papel: 'chefe', senha: 'senha-forte-2' })).status, 400);
  assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'z@unita.com.br', papel: 'viewer', senha: 'curta' })).status, 400);

  assert.equal((await viewer('POST', '/api/auth/login', { email: 'ver@unita.com.br', senha: 'errada-123' })).status, 401);
  assert.equal((await viewer('POST', '/api/auth/login', { email: 'ver@unita.com.br', senha: 'senha-forte-2' })).status, 200);
  assert.equal((await planejamento('POST', '/api/auth/login', { email: 'plan@unita.com.br', senha: 'senha-forte-2' })).status, 200);
});

test('sem login, nada de dados', async () => {
  assert.equal((await anonimo('GET', '/api/dados/resumo')).status, 401);
  assert.equal((await anonimo('GET', '/api/midias')).status, 401);
});

test('escrita sem o cabeçalho do app é recusada (CSRF)', async () => {
  const r = await viewer('POST', '/api/auth/logout', null, { 'x-requested-with': '' });
  assert.equal(r.status, 403);
});

test('dados: resumo com as 3 abas, cadastro e INCC; físico por obra', async () => {
  const r = await viewer('GET', '/api/dados/resumo', null, { 'accept-encoding': 'gzip' });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.dados.abas).sort(), ['BD_Econômico', 'BD_Infos Gerais', 'BD_Orc']);
  assert.ok(r.dados.abas['BD_Infos Gerais'].linhas.length > 60);
  assert.ok(r.dados.incc.length > 300, 'histórico do INCC-DI desde 1994');
  assert.equal(r.dados.fonte, 'Dados de exemplo (fictícios)');

  const f = await viewer('GET', `/api/dados/fisico?obra=${encodeURIComponent('residencial ALPHA')}`);
  assert.equal(f.status, 200);
  assert.equal(f.dados.linhas.length, 24 * 4, '4 itens × 24 meses, filtro ignora caixa');
});

test('permissões: viewer só lê; planejamento edita conteúdo; só dev administra', async () => {
  assert.equal((await viewer('POST', '/api/dados/atualizar')).status, 403);
  assert.equal((await viewer('PUT', '/api/obras/cadastro', { obra: 'X' })).status, 403);
  assert.equal((await viewer('GET', '/api/usuarios')).status, 403);
  assert.equal((await planejamento('GET', '/api/usuarios')).status, 403);
  const atualizado = await planejamento('POST', '/api/dados/atualizar');
  assert.equal(atualizado.status, 200);
  assert.ok(atualizado.dados.abas['BD_Infos Gerais'].linhas.length, 'devolve o resumo já relido');
  assert.ok(atualizado.dados.atualizadoEm);
  assert.equal((await dev('GET', '/api/usuarios')).status, 200);
});

test('cadastro de obra: salvar, atualizar pela chave e importar planilha', async () => {
  let r = await planejamento('PUT', '/api/obras/cadastro', { obra: 'Residencial Alpha', numeroUH: '200', areaEquivalente: '10.000,5', inicioObra: '15/01/2025' });
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  assert.equal(r.dados.numeroUH, 200);
  assert.equal(r.dados.areaEquivalente, 10000.5);
  assert.equal(r.dados.inicioObra, '2025-01-15');

  r = await planejamento('POST', '/api/obras/cadastro/importar', { linhas: [{ Obras: 'residencial alpha', "Nº UH's": 210 }, { Obras: 'Edifício Beta', 'INCC (Orç. Base)': 1000 }] });
  assert.equal(r.dados.importados, 2);
  const lista = (await viewer('GET', '/api/obras/cadastro')).dados;
  assert.equal(lista.length, 2, 'Alpha atualizada, não duplicada');
  if (store === 'supabase') assert.equal(srv.supabase.tabelas.get('cadastro_obras').length, 2, 'cadastro gravado no Supabase');
  assert.equal(lista.find((c) => c.chave === 'residencial alpha').numeroUH, 210);

  assert.equal((await planejamento('PUT', '/api/obras/cadastro', { numeroUH: 1 })).status, 400);
});

test('mídias: upload da imagem, cadastro por obra/mês, filtro, exclusão', async () => {
  assert.equal((await viewer('POST', '/api/arquivos', PNG, { 'content-type': 'image/png' })).status, 403);
  assert.equal((await planejamento('POST', '/api/arquivos', PNG, { 'content-type': 'application/x-msdownload' })).status, 415);

  const up = await planejamento('POST', '/api/arquivos', PNG, { 'content-type': 'image/png', 'x-nome-arquivo': encodeURIComponent('TxC torre A.png') });
  assert.equal(up.status, 201);
  assert.equal(up.dados.nome, 'TxC torre A.png');

  const baixado = await viewer('GET', `/api/arquivos/${up.dados.id}`);
  assert.equal(baixado.status, 200);
  assert.deepEqual(new Uint8Array(baixado.dados), PNG);

  assert.equal((await planejamento('POST', '/api/midias', { tipo: 'txc', obra: 'Residencial Alpha', mes: '2026-13', arquivoId: up.dados.id })).status, 400);
  const m = await planejamento('POST', '/api/midias', { tipo: 'txc', obra: 'Residencial Alpha', mes: '2026-03', grupo: 'Torre A', arquivoId: up.dados.id });
  assert.equal(m.status, 201);
  assert.equal(m.dados.destino, 'ambas', 'sem destino = Obra e Cliente');
  assert.equal(m.dados.visivelCliente, true);

  // Destino: só Cliente; o PUT parcial mantém o que não foi enviado.
  let ed = await planejamento('PUT', `/api/midias/${m.dados.id}`, { destino: 'cliente' });
  assert.equal(ed.status, 200);
  assert.deepEqual([ed.dados.destino, ed.dados.visivelCliente, ed.dados.grupo], ['cliente', true, 'Torre A']);
  ed = await planejamento('PUT', `/api/midias/${m.dados.id}`, { destino: 'obra' });
  assert.deepEqual([ed.dados.destino, ed.dados.visivelCliente], ['obra', false]);
  ed = await planejamento('PUT', `/api/midias/${m.dados.id}`, { destino: 'ambas' });
  assert.equal(ed.dados.destino, 'ambas');

  const lista = await viewer('GET', '/api/midias?tipo=txc&chaveObra=residencial%20alpha&mes=2026-03');
  assert.equal(lista.dados.length, 1);
  assert.equal((await viewer('GET', '/api/midias?tipo=foto')).dados.length, 0);

  assert.equal((await planejamento('DELETE', `/api/midias/${m.dados.id}`)).status, 200);
  assert.equal((await viewer('GET', `/api/arquivos/${up.dados.id}`)).status, 404, 'imagem apagada junto');
});

test('telas do cliente: criar com blocos, validar e remover arquivos órfãos', async () => {
  const img = await planejamento('POST', '/api/arquivos', PNG, { 'content-type': 'image/png' });
  const csv = await planejamento('POST', '/api/arquivos', new TextEncoder().encode('a;b\n1;2'), { 'content-type': 'text/csv' });
  assert.equal((await planejamento('POST', '/api/telas', { titulo: '' })).status, 400);
  assert.equal((await planejamento('POST', '/api/telas', { titulo: 'X', blocos: [{ tipo: 'imagem' }] })).status, 400);

  const t = await planejamento('POST', '/api/telas', {
    titulo: 'Cronograma de entregas', obras: ['Residencial Alpha'],
    blocos: [{ tipo: 'imagem', arquivoId: img.dados.id }, { tipo: 'planilha', arquivoId: csv.dados.id, largura: 'metade' }, { tipo: 'texto', texto: 'Observações' }],
  });
  assert.equal(t.status, 201, JSON.stringify(t.dados));
  assert.deepEqual(t.dados.obras, ['residencial alpha']);
  assert.equal(t.dados.destino, 'cliente', 'sem destino = Somente Cliente, como antes');

  const daObra = await planejamento('POST', '/api/telas', { titulo: 'Equipe da obra', destino: 'obra', blocos: [{ tipo: 'texto', texto: 'Interno' }] });
  assert.equal(daObra.status, 201);
  assert.equal(daObra.dados.destino, 'obra');
  const editada = await planejamento('PUT', `/api/telas/${daObra.dados.id}`, { ...daObra.dados, destino: 'ambas' });
  assert.equal(editada.dados.destino, 'ambas');
  assert.equal((await viewer('GET', '/api/telas')).dados.find((x) => x.id === daObra.dados.id).destino, 'ambas');
  assert.equal((await planejamento('DELETE', `/api/telas/${daObra.dados.id}`)).status, 200);

  const sem = await planejamento('PUT', `/api/telas/${t.dados.id}`, { ...t.dados, blocos: t.dados.blocos.slice(1) });
  assert.equal(sem.status, 200);
  assert.equal((await viewer('GET', `/api/arquivos/${img.dados.id}`)).status, 404, 'imagem retirada da tela foi apagada');

  assert.equal((await planejamento('DELETE', `/api/telas/${t.dados.id}`)).status, 200);
  assert.equal((await viewer('GET', `/api/arquivos/${csv.dados.id}`)).status, 404);
});

test('envio em dois passos: pede o modo, envia e lê de volta', async () => {
  assert.equal((await viewer('POST', '/api/arquivos/envio', { nome: 'x.png', tipo: 'image/png', tamanho: 10 })).status, 403);
  assert.equal((await planejamento('POST', '/api/arquivos/envio', { nome: 'x.exe', tipo: 'application/x-msdownload', tamanho: 10 })).status, 415);
  assert.equal((await planejamento('POST', '/api/arquivos/envio', { nome: 'x.png', tipo: 'image/png', tamanho: 999_999_999 })).status, 413);
  const preparo = await planejamento('POST', '/api/arquivos/envio', { nome: 'foto.png', tipo: 'image/png', tamanho: PNG.length });
  assert.equal(preparo.dados.envio.modo, store === 'supabase' ? 'direto' : 'servidor');
  const enviado = await enviarArquivo(planejamento, srv.fetchExterno, PNG, 'image/png', 'Fachada março.png');
  assert.equal(enviado.status, 201);
  const lido = await viewer('GET', `/api/arquivos/${enviado.dados.id}`);
  assert.equal(lido.status, 200);
  assert.deepEqual(new Uint8Array(lido.dados), PNG);
  assert.equal((await planejamento('DELETE', `/api/arquivos/${enviado.dados.id}`)).status, 200);
  assert.equal((await viewer('GET', `/api/arquivos/${enviado.dados.id}`)).status, 404);
  if (store === 'supabase') {
    assert.ok(srv.supabase.chamadas.some((c) => c.startsWith('PUT /storage/v1/object/upload/sign/apresentacao/anexos/')), 'navegador enviou direto ao Storage');
    assert.equal([...srv.supabase.objetos.keys()].filter((k) => k.includes(enviado.dados.id)).length, 0, 'arquivo removido do Storage');
  }
});

test('INCC manual prevalece', async () => {
  const r = await planejamento('PUT', '/api/incc/2026-09', { indice: 1300.5 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.dados.itens.find((i) => i.mes === '2026-09'), { mes: '2026-09', indice: 1300.5, origem: 'manual' });
  assert.equal((await planejamento('PUT', '/api/incc/setembro', { indice: 1 })).status, 400);
});

test('usuário desativado perde o acesso na hora', async () => {
  const lista = (await dev('GET', '/api/usuarios')).dados;
  const ver = lista.find((u) => u.papel === 'viewer');
  assert.equal((await dev('PUT', `/api/usuarios/${ver.id}`, { ativo: false })).status, 200);
  assert.equal((await viewer('GET', '/api/dados/resumo')).status, 401);
  assert.equal((await viewer('POST', '/api/auth/login', { email: 'ver@unita.com.br', senha: 'senha-forte-2' })).status, 401, 'nem entra de novo');
  const eu = lista.find((u) => u.papel === 'dev');
  assert.equal((await dev('PUT', `/api/usuarios/${eu.id}`, { papel: 'viewer' })).status, 400, 'dev não rebaixa a si mesmo');
});

test('estáticos e caminho fora de public', async () => {
  const r = await anonimo('GET', '/');
  assert.equal(r.status, 200);
  assert.equal((await anonimo('GET', '/..%2F.env.local')).status, 404);
  assert.equal((await anonimo('GET', '/api/nada')).status, 404);
});
});
}
