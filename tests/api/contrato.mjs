/**
 * Regressão do contrato REST (docs/API.md), executada nos dois armazenamentos:
 * contrato-local.test.mjs (arquivos JSON) e contrato-supabase.test.mjs (Supabase simulado).
 * A futura versão PHP deve passar nestes mesmos cenários.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { cookieExpirado, cookieSessao } from '../../server/auth/sessao.mjs';
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
  assert.deepEqual(r.dados, { usuario: null, precisaConfigurar: true, convite: store === 'supabase' });

  r = await anonimo('POST', '/api/auth/configurar', { nome: 'Fora', email: 'fora@gmail.com', senha: 'senha-forte-1' });
  assert.equal(r.status, 400, 'só e-mails do DOMINIO_EMAIL');
  assert.match(r.dados.erro, /@unita\.com\.br/);

  r = await dev('POST', '/api/auth/configurar', { nome: 'Lucas', email: 'Lucas@Unita.com.br', senha: 'senha-forte-1' });
  assert.equal(r.status, 201);
  assert.equal(r.dados.usuario.papel, 'dev');
  assert.equal(r.dados.usuario.email, 'lucas@unita.com.br');
  assert.equal(r.dados.usuario.senhaHash, undefined, 'hash nunca sai na API');

  r = await anonimo('POST', '/api/auth/configurar', { nome: 'Outro', email: 'outro@unita.com.br', senha: 'senha-forte-1' });
  assert.equal(r.status, 409);
  if (store === 'supabase') {
    assert.equal(srv.supabase.usuarios.size, 1, 'usuário criado no Supabase Auth');
    assert.equal(srv.supabase.tabelas.get('perfis')?.[0]?.papel, 'dev', 'papel na tabela perfis');
  }
});

/**
 * Local: o Dev define a senha inicial. Supabase: o Dev só convida e a pessoa cria a senha pelo link do e-mail
 * (o simulador guarda o token que o link levaria).
 */
async function cadastrar(nome, email, papel, senha, extra = {}) {
  if (store === 'local') return dev('POST', '/api/usuarios', { nome, email, papel, senha, ...extra });
  const r = await dev('POST', '/api/usuarios', { nome, email, papel, ...extra });
  if (r.status !== 201) return r;
  const convite = srv.supabase.emails.at(-1);
  assert.deepEqual([convite.tipo, convite.email], ['invite', email]);
  assert.match(convite.endereco, /^http:\/\/127\.0\.0\.1:\d+\/$/, 'link volta para o próprio app');
  const definida = await cliente(srv.base, srv.fetchExterno)('POST', '/api/auth/definir-senha', { token: convite.token, senha });
  assert.equal(definida.status, 200, JSON.stringify(definida.dados));
  assert.equal(definida.dados.usuario.papel, papel);
  return r;
}

test('dev cria usuários de Planejamento e Viewer; login e erros', async () => {
  for (const [email, papel] of [['plan@unita.com.br', 'planejamento'], ['ver@unita.com.br', 'viewer']]) {
    const r = await cadastrar(papel, email, papel, 'senha-forte-2');
    assert.equal(r.status, 201, JSON.stringify(r.dados));
  }
  assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'ver@unita.com.br', papel: 'viewer', senha: 'senha-forte-2' })).status, 409);
  assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'z@unita.com.br', papel: 'chefe', senha: 'senha-forte-2' })).status, 400);
  assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'z@gmail.com', papel: 'viewer', senha: 'senha-forte-2' })).status, 400, 'fora do domínio');
  if (store === 'local') assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'z@unita.com.br', papel: 'viewer', senha: 'curta' })).status, 400);

  assert.equal((await viewer('POST', '/api/auth/login', { email: 'ver@unita.com.br', senha: 'errada-123' })).status, 401);
  assert.equal((await viewer('POST', '/api/auth/login', { email: 'ver@unita.com.br', senha: 'senha-forte-2' })).status, 200);
  assert.equal((await planejamento('POST', '/api/auth/login', { email: 'plan@unita.com.br', senha: 'senha-forte-2' })).status, 200);
});

test('e-mail de acesso: reenvio, esqueci minha senha e link inválido', async () => {
  const usuarios = (await dev('GET', '/api/usuarios')).dados;
  const ver = usuarios.find((u) => u.email === 'ver@unita.com.br');
  if (store === 'local') {
    assert.equal((await dev('POST', `/api/usuarios/${ver.id}/acesso`)).status, 400, 'sem e-mail no modo local');
    assert.equal((await anonimo('POST', '/api/auth/recuperar', { email: ver.email })).status, 400);
    return;
  }
  const emails = srv.supabase.emails;
  assert.equal((await viewer('POST', `/api/usuarios/${ver.id}/acesso`)).status, 403, 'só o Dev reenvia');
  assert.equal((await dev('POST', `/api/usuarios/${ver.id}/acesso`)).status, 200);
  assert.equal(emails.at(-1).tipo, 'recovery', 'quem já confirmou recebe o link de nova senha');

  const antes = emails.length;
  assert.equal((await anonimo('POST', '/api/auth/recuperar', { email: 'ninguem@unita.com.br' })).status, 200, 'não revela se existe');
  assert.equal(emails.length, antes);
  assert.equal((await anonimo('POST', '/api/auth/recuperar', { email: 'VER@unita.com.br' })).status, 200);
  const link = emails.at(-1);
  assert.deepEqual([link.tipo, link.email], ['recovery', 'ver@unita.com.br']);

  assert.equal((await anonimo('POST', '/api/auth/definir-senha', { token: 'falso', senha: 'senha-nova-123' })).status, 400);
  assert.equal((await anonimo('POST', '/api/auth/definir-senha', { token: link.token, senha: 'curta' })).status, 400);
  const nova = cliente(srv.base, srv.fetchExterno);
  assert.equal((await nova('POST', '/api/auth/definir-senha', { token: link.token, senha: 'senha-forte-2' })).status, 200);
  assert.equal((await nova('GET', '/api/auth/sessao')).dados.usuario.email, 'ver@unita.com.br', 'já entra');
});

test('cookie de sessão: SameSite=Lax em http (local); em HTTPS, SameSite=None; Secure; Partitioned (iframe do portal)', async () => {
  const r = await cliente(srv.base, srv.fetchExterno)('POST', '/api/auth/login', { email: 'ver@unita.com.br', senha: 'senha-forte-2' });
  const cookie = r.res.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Secure/);
  assert.equal(cookieSessao('x', { seguro: true }), 'sessao=x; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=43200');
  assert.equal(cookieExpirado({ seguro: true }), 'sessao=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0');
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

test('layout do Resumo Geral: só o dev salva, sem sobreposição, e vale para todos no resumo', async () => {
  assert.equal((await viewer('GET', '/api/dados/resumo')).dados.layoutResumoGeral, null, 'sem layout salvo = padrão do app');
  const layout = {
    cef: { x: 1, y: 1, w: 6, h: 11 }, economica: { x: 1, y: 12, w: 6, h: 13 }, curva: { x: 7, y: 1, w: 18, h: 8 },
    barras: { x: 7, y: 9, w: 18, h: 5 }, assertividade: { x: 7, y: 14, w: 18, h: 5 }, custos: { x: 7, y: 19, w: 7, h: 6 },
    incc: { x: 14, y: 19, w: 4, h: 6 }, nhnu: { x: 18, y: 19, w: 3, h: 6 }, andamento: { x: 21, y: 19, w: 4, h: 6 },
  };
  assert.equal((await viewer('PUT', '/api/layouts/resumo-geral', { layout })).status, 403);
  assert.equal((await planejamento('PUT', '/api/layouts/resumo-geral', { layout })).status, 403);
  const sobreposto = await dev('PUT', '/api/layouts/resumo-geral', { layout: { ...layout, nhnu: layout.incc } });
  assert.equal(sobreposto.status, 400);
  assert.match(sobreposto.dados.erro, /INCC e NH-NU/);
  const salvo = await dev('PUT', '/api/layouts/resumo-geral', { layout });
  assert.equal(salvo.status, 200);
  assert.deepEqual(salvo.dados.layout, layout);
  assert.deepEqual((await viewer('GET', '/api/dados/resumo')).dados.layoutResumoGeral, layout, 'todos recebem o layout do dev');
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

/**
 * v26 — Viewer restrito por obra e por apresentação: o servidor só entrega as obras liberadas (planilhas,
 * cadastro, físico, mídias, telas e arquivos) e, para quem tem só o Cliente, sem as colunas "- Obra".
 */
test('acesso por obra e apresentação: viewer restrito só recebe o que foi liberado', async () => {
  const PREVISTO_OBRA = 'Previsto Original Acumulado - Obra';
  const PREVISTO_CLIENTE = 'Previsto Original Acumulado - Cliente';
  const restrito = cliente(srv.base, srv.fetchExterno);
  assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'x1@unita.com.br', papel: 'viewer', senha: 'senha-forte-2', apresentacoes: 'tudo' })).status, 400);
  assert.equal((await dev('POST', '/api/usuarios', { nome: 'x', email: 'x2@unita.com.br', papel: 'viewer', senha: 'senha-forte-2', obras: 'Residencial Alpha' })).status, 400);
  const criado = await cadastrar('Restrito', 'restrito@unita.com.br', 'viewer', 'senha-forte-5', { obras: ['Residencial Alpha'], apresentacoes: 'cliente' });
  assert.equal(criado.status, 201, JSON.stringify(criado.dados));
  assert.deepEqual([criado.dados.obras, criado.dados.apresentacoes], [['residencial alpha'], 'cliente'], 'obras gravadas pela chave');
  assert.equal((await restrito('POST', '/api/auth/login', { email: 'restrito@unita.com.br', senha: 'senha-forte-5' })).status, 200);
  assert.equal((await restrito('GET', '/api/auth/sessao')).dados.usuario.apresentacoes, 'cliente', 'o front sabe o que mostrar');

  // Planilhas: só as linhas da Alpha e, só com o Cliente, sem as colunas "- Obra".
  let r = await restrito('GET', '/api/dados/resumo');
  const infos = r.dados.abas['BD_Infos Gerais'];
  const iNome = infos.colunas.indexOf('Nome da Obra');
  assert.ok(infos.linhas.length > 0);
  assert.deepEqual([...new Set(infos.linhas.map((l) => l[iNome]))], ['Residencial Alpha']);
  assert.ok(!infos.colunas.includes(PREVISTO_OBRA), 'colunas internas não saem');
  assert.ok(infos.colunas.includes(PREVISTO_CLIENTE));
  for (const aba of ['BD_Orc', 'BD_Econômico']) {
    const m = r.dados.abas[aba];
    const i = m.colunas.indexOf('Nome da Obra');
    assert.deepEqual([...new Set(m.linhas.map((l) => l[i]))], ['Residencial Alpha'], aba);
  }
  assert.deepEqual(r.dados.cadastro.map((c) => c.chave), ['residencial alpha'], 'cadastro só da obra liberada');
  assert.deepEqual((await restrito('GET', '/api/obras/cadastro')).dados.map((c) => c.chave), ['residencial alpha']);
  assert.equal((await restrito('GET', `/api/dados/fisico?obra=${encodeURIComponent('Edifício Beta')}`)).status, 403);
  r = await restrito('GET', `/api/dados/fisico?obra=${encodeURIComponent('Residencial Alpha')}`);
  assert.equal(r.status, 200);
  assert.equal(r.dados.linhas.length, 24 * 4);
  assert.ok(!r.dados.colunas.includes('Comentários - Obra'));

  // Mídias, telas e arquivos: obra liberada e destino na apresentação liberada.
  const arquivo = async () => (await planejamento('POST', '/api/arquivos', PNG, { 'content-type': 'image/png' })).dados.id;
  const midia = async (obra, destino) => (await planejamento('POST', '/api/midias', { tipo: 'foto', obra, mes: '2026-03', arquivoId: await arquivo(), destino })).dados;
  const alphaCliente = await midia('Residencial Alpha', 'ambas');
  const alphaObra = await midia('Residencial Alpha', 'obra');
  const beta = await midia('Edifício Beta', 'ambas');
  assert.deepEqual((await restrito('GET', '/api/midias?tipo=foto')).dados.map((m) => m.id), [alphaCliente.id]);
  assert.equal((await viewer('GET', '/api/midias?tipo=foto')).dados.length, 3, 'viewer sem restrição vê tudo');
  assert.equal((await restrito('GET', `/api/arquivos/${alphaCliente.arquivoId}`)).status, 200);
  assert.equal((await restrito('GET', `/api/arquivos/${beta.arquivoId}`)).status, 404, 'imagem de obra não liberada');
  assert.equal((await restrito('GET', `/api/arquivos/${alphaObra.arquivoId}`)).status, 404, 'imagem só da Obra');

  const tela = async (titulo, destino, obras) => (await planejamento('POST', '/api/telas', { titulo, destino, obras, blocos: [{ tipo: 'texto', texto: titulo }] })).dados;
  const telas = [await tela('Geral cliente', 'cliente', []), await tela('Alpha e Beta', 'ambas', ['Residencial Alpha', 'Edifício Beta']), await tela('Só Beta', 'ambas', ['Edifício Beta']), await tela('Interna', 'obra', [])];
  r = await restrito('GET', '/api/telas');
  assert.deepEqual(r.dados.map((t) => t.titulo).sort(), ['Alpha e Beta', 'Geral cliente']);
  assert.deepEqual(r.dados.find((t) => t.titulo === 'Alpha e Beta').obras, ['residencial alpha'], 'sem o nome das obras não liberadas');

  // Só a Obra e todas as obras: recebe as duas variantes de coluna (o Painel de obras usa as "- Cliente").
  const id = criado.dados.id;
  assert.equal((await dev('PUT', `/api/usuarios/${id}`, { apresentacoes: 'x' })).status, 400);
  r = await dev('PUT', `/api/usuarios/${id}`, { obras: null, apresentacoes: 'obra' });
  assert.deepEqual([r.dados.obras, r.dados.apresentacoes], [null, 'obra']);
  r = await restrito('GET', '/api/dados/resumo');
  assert.equal(new Set(r.dados.abas['BD_Infos Gerais'].linhas.map((l) => l[iNome])).size, 3, 'vale na hora, sem novo login');
  assert.ok(r.dados.abas['BD_Infos Gerais'].colunas.includes(PREVISTO_OBRA));
  assert.ok(r.dados.abas['BD_Infos Gerais'].colunas.includes(PREVISTO_CLIENTE));
  assert.deepEqual((await restrito('GET', '/api/telas')).dados.map((t) => t.titulo).sort(), ['Alpha e Beta', 'Interna', 'Só Beta']);

  // Lista vazia = nenhuma obra.
  await dev('PUT', `/api/usuarios/${id}`, { obras: [] });
  r = await restrito('GET', '/api/dados/resumo');
  assert.equal(r.dados.abas['BD_Infos Gerais'].linhas.length, 0);
  assert.equal(r.dados.cadastro.length, 0);

  // Só o Viewer é restrito: Planejamento com obras gravadas continua vendo tudo.
  const plan = (await dev('GET', '/api/usuarios')).dados.find((u) => u.papel === 'planejamento');
  await dev('PUT', `/api/usuarios/${plan.id}`, { obras: [], apresentacoes: 'cliente' });
  r = await planejamento('GET', '/api/dados/resumo');
  assert.equal(new Set(r.dados.abas['BD_Infos Gerais'].linhas.map((l) => l[iNome])).size, 3);
  await dev('PUT', `/api/usuarios/${plan.id}`, { obras: null, apresentacoes: 'ambas' });

  for (const m of [alphaCliente, alphaObra, beta]) await planejamento('DELETE', `/api/midias/${m.id}`);
  for (const t of telas) await planejamento('DELETE', `/api/telas/${t.id}`);
});

test('INCC manual prevalece', async () => {
  const r = await planejamento('PUT', '/api/incc/2026-09', { indice: 1300.5 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.dados.itens.find((i) => i.mes === '2026-09'), { mes: '2026-09', indice: 1300.5, origem: 'manual' });
  assert.equal((await planejamento('PUT', '/api/incc/setembro', { indice: 1 })).status, 400);
});

test('usuário desativado perde o acesso na hora', async () => {
  const lista = (await dev('GET', '/api/usuarios')).dados;
  const ver = lista.find((u) => u.email === 'ver@unita.com.br');
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
