/**
 * Inicialização: sessão, shell (header + filtros), rotas e redesenho quando o filtro muda.
 *
 * Rotas:
 *   #/obra/<aba>            apresentação Obra
 *   #/cliente/<aba>         apresentação Cliente (colunas "- Cliente" + telas extras)
 *   #/cliente/tela/<id>     tela personalizada do cliente
 *   #/admin/<seção>         administração (Planejamento/Dev)
 *   #/conta                 minha conta
 */
import { api } from './core/api.js';
import { h, montar } from './core/dom.js';
import { estado } from './core/estado.js';
import { caminhoAtual, ir, resolver, rota } from './core/roteador.js';
import { telasDaObra } from './domain/conteudo.js';
import { PAPEIS, pode } from './domain/permissoes.js';
import { alerta, carregando, toast } from './ui/componentes.js';
import { barraFiltros } from './ui/filtros.js';
import { icone } from './ui/icones.js';
import { renderAdminCadastro } from './pages/admin-cadastro.js';
import { renderAdminFontes } from './pages/admin-fontes.js';
import { renderAdminMidias } from './pages/admin-midias.js';
import { renderAdminTelas } from './pages/admin-telas.js';
import { renderAdminUsuarios } from './pages/admin-usuarios.js';
import { renderConta } from './pages/conta.js';
import { renderGaleria } from './pages/galeria.js';
import { renderInicio } from './pages/inicio.js';
import { renderLogin } from './pages/login.js';
import { renderResumoEconomico } from './pages/resumo-economico.js';
import { renderResumoFisico } from './pages/resumo-fisico.js';
import { renderResumoGeral } from './pages/resumo-geral.js';
import { renderTelaCliente } from './pages/tela-cliente.js';

const raiz = document.getElementById('app');

/**
 * Abas das apresentações, na ordem pedida.
 * `periodo: false` = sem intervalo dos gráficos no filtro; `capa: true` = sem barra de filtros e largura total.
 * `icone` e `descricao` aparecem nos atalhos da capa.
 */
const ABAS = [
  { id: 'inicio', nome: 'Início', render: renderInicio, periodo: false, capa: true, icone: 'casa' },
  { id: 'resumo-geral', nome: 'Resumo Geral', render: renderResumoGeral, icone: 'grafico', descricao: 'Curvas, CEF × físico e análise econômica' },
  { id: 'resumo-fisico', nome: 'Resumo Físico', render: renderResumoFisico, periodo: false, icone: 'fisico', descricao: 'Avanço por atividade da EAP' },
  { id: 'resumo-economico', nome: 'Resumo Econômico', render: renderResumoEconomico, periodo: false, icone: 'economico', descricao: 'IEC, custos e resultado por item' },
  { id: 'tempo-caminho', nome: 'Tempo x Caminho', render: (a, c) => renderGaleria(a, c, 'txc'), periodo: false, icone: 'caminho', descricao: 'Linhas de balanço por torre' },
  { id: 'fotos', nome: 'Acompanhamento Fotográfico', render: (a, c) => renderGaleria(a, c, 'foto'), periodo: false, icone: 'camera', descricao: 'Fotos do mês por local' },
];

const SECOES_ADMIN = [
  { id: 'cadastro-obras', nome: 'Cadastro de obras', render: renderAdminCadastro, capacidade: 'editarConteudo' },
  { id: 'midias', nome: 'TxC e fotos', render: renderAdminMidias, capacidade: 'editarConteudo' },
  { id: 'telas', nome: 'Telas do cliente', render: renderAdminTelas, capacidade: 'editarConteudo' },
  { id: 'usuarios', nome: 'Usuários', render: renderAdminUsuarios, capacidade: 'administrar' },
  { id: 'fontes', nome: 'Fontes e INCC', render: renderAdminFontes, capacidade: 'editarConteudo' },
];

let telasCliente = [];

// ── Rotas ────────────────────────────────────────────────────────────
for (const visao of ['obra', 'cliente']) {
  rota(`/${visao}/:aba`, ({ aba }) => paginaApresentacao(visao, ABAS.find((a) => a.id === aba) ?? ABAS[0]));
}
rota('/cliente/tela/:id', ({ id }) => paginaApresentacao('cliente', {
  id: `tela-${id}`, nome: 'Tela', periodo: false, render: (alvo) => renderTelaCliente(alvo, telasCliente.find((t) => t.id === id)),
}));
rota('/admin/:secao', ({ secao }) => paginaAdmin(SECOES_ADMIN.find((s) => s.id === secao) ?? SECOES_ADMIN[0]));
rota('/conta', () => paginaSimples(renderConta));

// ── Shell ────────────────────────────────────────────────────────────
function cabecalho(visao, abaAtual) {
  const u = estado.usuario;
  const telas = visao === 'cliente' ? telasDaObra(telasCliente, estado.filtro.obras ?? []) : [];
  const link = (href, texto, atual) => h('a', { href: `#${href}`, 'aria-current': atual ? 'page' : null }, texto);
  return h('header', { class: 'app-header' }, h('div', { class: 'in' },
    h('a', { href: '#/obra/inicio', 'aria-label': 'Início' }, h('img', { class: 'logo', src: 'assets/brand/logo-unita-white.png', alt: 'Unità Engenharia' })),
    visao ? h('nav', { 'aria-label': 'Abas da apresentação' },
      ABAS.map((a) => link(`/${visao}/${a.id}`, a.nome, a.id === abaAtual)),
      telas.map((t) => link(`/cliente/tela/${t.id}`, t.titulo, abaAtual === `tela-${t.id}`))) : h('nav', {}),
    h('div', { class: 'direita' },
      h('div', { class: 'visao', role: 'group', 'aria-label': 'Apresentação' },
        h('a', { href: `#/obra/${ABAS.some((a) => a.id === abaAtual) ? abaAtual : 'inicio'}`, 'aria-current': String(visao === 'obra') }, 'Obra'),
        h('a', { href: `#/cliente/${ABAS.some((a) => a.id === abaAtual) ? abaAtual : 'inicio'}`, 'aria-current': String(visao === 'cliente') }, 'Cliente')),
      h('button', { class: 'btn inverse sm', type: 'button', title: 'Tela cheia', onclick: alternarApresentacao }, icone('telaCheia', { tamanho: 16 }), 'Apresentar'),
      pode(u.papel, 'editarConteudo') ? h('a', { class: 'btn inverse sm so-edicao', href: '#/admin/cadastro-obras' }, icone('engrenagem', { tamanho: 16 }), 'Administração') : null,
      // Sem login (LOGIN=desligado) não há conta nem "Sair".
      u.semLogin ? null : [
        h('a', { class: 'usuario', href: '#/conta', style: { textDecoration: 'none' } }, h('b', {}, u.nome), h('span', {}, PAPEIS[u.papel]?.nome)),
        h('button', { class: 'btn inverse sm', type: 'button', onclick: sair, 'aria-label': 'Sair' }, icone('sair', { tamanho: 16 }))])));
}

function alternarApresentacao() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
document.addEventListener('fullscreenchange', () => document.body.classList.toggle('apresentando', Boolean(document.fullscreenElement)));

async function sair() {
  await api.post('/auth/logout').catch(() => {});
  estado.usuario = null;
  iniciar();
}

function estadoDosDados() {
  if (estado.carregando && !estado.bruto) return carregando(8);
  if (estado.erro) return alerta('error', 'Não foi possível carregar os dados', estado.erro);
  return null;
}

async function paginaApresentacao(visao, aba) {
  const conteudo = h('main', { class: `conteudo ${aba.capa ? 'cheio' : ''}`, id: 'conteudo' });
  const bloqueio = estadoDosDados();
  const base = estado.base(visao);
  montar(raiz, cabecalho(visao, aba.id), base && !aba.capa ? barraFiltros({ mostrarPeriodo: aba.periodo !== false }) : null, conteudo);
  if (estado.bruto?.aviso) conteudo.append(alerta('warning', 'Dados possivelmente desatualizados', estado.bruto.aviso));
  if (bloqueio || !base) return conteudo.append(bloqueio ?? carregando(8));
  const alvo = h('div');
  conteudo.append(alvo);
  try {
    const telas = visao === 'cliente' ? telasDaObra(telasCliente, estado.filtro.obras ?? []) : [];
    await aba.render(alvo, { base, filtro: estado.filtro, visao, usuario: estado.usuario, abas: ABAS, telas });
  } catch (e) {
    console.error(e);
    montar(alvo, alerta('error', 'Erro ao montar a aba', e.message));
  }
}

async function paginaAdmin(secao) {
  if (!pode(estado.usuario.papel, secao.capacidade)) return ir('/obra/inicio');
  const alvo = h('div', { class: 'painel-admin' });
  montar(raiz, cabecalho(null, null), h('main', { class: 'conteudo' }, h('div', { class: 'admin' },
    h('aside', {}, h('div', { class: 'eyebrow' }, 'Administração'), h('h3', {}, 'Conteúdo da apresentação'),
      h('nav', { 'aria-label': 'Seções' }, SECOES_ADMIN.filter((s) => pode(estado.usuario.papel, s.capacidade))
        .map((s) => h('a', { href: `#/admin/${s.id}`, 'aria-current': s.id === secao.id ? 'page' : null }, s.nome)))),
    alvo)));
  const bloqueio = estadoDosDados();
  if (bloqueio || !estado.bruto) return montar(alvo, bloqueio ?? carregando(6));
  try {
    await secao.render(alvo);
  } catch (e) {
    montar(alvo, alerta('error', 'Erro ao montar a seção', e.message));
  }
}

function paginaSimples(render) {
  const alvo = h('main', { class: 'conteudo' });
  montar(raiz, cabecalho(null, null), alvo);
  render(alvo);
}

function desenhar() {
  if (!estado.usuario) return;
  const r = resolver();
  if (!r) return ir('/obra/inicio');
  r.tratador(r.params);
}

// ── Inicialização ────────────────────────────────────────────────────
async function iniciar() {
  montar(raiz, carregando(3));
  let sessao;
  try {
    sessao = await api.get('/auth/sessao');
  } catch (e) {
    return montar(raiz, h('main', { class: 'conteudo' }, alerta('error', 'Servidor indisponível', e.message)));
  }
  if (!sessao.usuario) {
    return renderLogin(raiz, { precisaConfigurar: sessao.precisaConfigurar, aoEntrar: (usuario) => { estado.usuario = usuario; carregarTudo(); } });
  }
  estado.usuario = sessao.usuario;
  carregarTudo();
}

async function carregarTudo() {
  if (!caminhoAtual().startsWith('/') || caminhoAtual() === '/') ir('/obra/inicio');
  desenhar();
  await Promise.all([estado.carregarDados(), carregarTelas()]);
  desenhar(); // as telas do cliente podem chegar depois dos dados: redesenha para o menu e a capa mostrarem
}

async function carregarTelas() {
  telasCliente = await api.get('/telas').catch(() => []);
}

estado.ouvir(() => { if (!estado.carregando || !estado.bruto) desenhar(); });
window.addEventListener('hashchange', () => {
  if (caminhoAtual().startsWith('/cliente') || caminhoAtual().startsWith('/admin/telas')) carregarTelas().then(desenhar);
  else desenhar();
});
window.addEventListener('sessao-expirada', () => {
  if (!estado.usuario) return;
  estado.usuario = null;
  toast('warning', 'Sua sessão expirou', 'Entre novamente.');
  iniciar();
});

iniciar();
