/**
 * Inicialização: sessão, shell (header + filtros), rotas e redesenho quando o filtro muda.
 *
 * Rotas:
 *   #/obra/<aba>            apresentação Obra
 *   #/cliente/<aba>         apresentação Cliente (colunas "- Cliente")
 *   #/<visão>/tela/<id>     tela extra (Administração → Novas telas) da apresentação Obra ou Cliente
 *   #/admin/<seção>         administração (Planejamento/Dev; papel Segurança: só Segurança do Trabalho)
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
import { renderAdminSeguranca } from './pages/admin-seguranca.js';
import { renderDashboardSeguranca } from './pages/dashboard-seguranca.js';
import { renderSegurancaTrabalho } from './pages/seguranca-trabalho.js';
import { renderAdminTelas } from './pages/admin-telas.js';
import { renderAdminUsuarios } from './pages/admin-usuarios.js';
import { renderConta } from './pages/conta.js';
import { renderGaleria } from './pages/galeria.js';
import { renderInicio } from './pages/inicio.js';
import { renderDefinirSenha, renderLogin, retornoDoEmail } from './pages/login.js';
import { renderResumoEconomico } from './pages/resumo-economico.js';
import { renderResumoFisico } from './pages/resumo-fisico.js';
import { renderResumoGeral } from './pages/resumo-geral.js';
import { renderTelaExtra } from './pages/tela-extra.js';

const raiz = document.getElementById('app');

/**
 * Abas das apresentações, na ordem pedida.
 * `capa: true` = sem barra de filtros e largura total.
 * `icone` e `descricao` aparecem nos atalhos da capa.
 * `cliente: 'opcional'` = na apresentação Cliente só aparece se alguma obra do filtro estiver marcada no
 * Cadastro de obras (campo em `opcaoCliente`); na Obra aparece sempre.
 */
const ABAS = [
  { id: 'inicio', nome: 'Início', render: renderInicio, capa: true, icone: 'casa' },
  { id: 'resumo-geral', nome: 'Resumo Geral', render: renderResumoGeral, icone: 'grafico', descricao: 'Curvas, CEF × físico e análise econômica' },
  { id: 'resumo-fisico', nome: 'Resumo Físico', render: renderResumoFisico, icone: 'fisico', descricao: 'Avanço por atividade da EAP' },
  { id: 'resumo-economico', nome: 'Resumo Econômico', render: renderResumoEconomico, icone: 'economico', descricao: 'IEC, custos e resultado por item' },
  { id: 'tempo-caminho', nome: 'Tempo x Caminho', render: (a, c) => renderGaleria(a, c, 'txc'), icone: 'caminho', descricao: 'Linhas de balanço por torre' },
  { id: 'fotos', nome: 'Acompanhamento Fotográfico', render: (a, c) => renderGaleria(a, c, 'foto'), icone: 'camera', descricao: 'Fotos do mês por local' },
  // v22 — Segurança do Trabalho (dados e Dashboard Segurança: Administração → Segurança do Trabalho)
  { id: 'seguranca-trabalho', nome: 'Segurança do Trabalho', render: renderSegurancaTrabalho, icone: 'alerta', descricao: 'Acidentes ocorridos no mês por tipo', cliente: 'opcional', opcaoCliente: 'segurancaCliente' },
];

const SECOES_ADMIN = [
  { id: 'cadastro-obras', nome: 'Cadastro de obras', render: renderAdminCadastro, capacidade: 'editarConteudo' },
  { id: 'midias', nome: 'TxC e fotos', render: renderAdminMidias, capacidade: 'editarConteudo' },
  { id: 'telas', nome: 'Novas telas', render: renderAdminTelas, capacidade: 'editarConteudo' },
  { id: 'seguranca', nome: 'Segurança do Trabalho', render: renderAdminSeguranca, capacidade: 'editarSeguranca' },
  // Sub-aba de Segurança do Trabalho (botão "Dashboard Segurança"); não aparece na lista lateral.
  { id: 'seguranca-dashboard', nome: 'Dashboard Segurança', render: renderDashboardSeguranca, capacidade: 'editarSeguranca', dentroDe: 'seguranca' },
  { id: 'usuarios', nome: 'Usuários', render: renderAdminUsuarios, capacidade: 'administrar' },
  { id: 'fontes', nome: 'Fontes e INCC', render: renderAdminFontes, capacidade: 'editarConteudo' },
];

let telasExtras = [];

/** Telas extras que aparecem na apresentação `visao` para as obras filtradas. */
const telasDaVisao = (visao) => (visao ? telasDaObra(telasExtras, estado.filtro.obras ?? [], visao) : []);

/** Abas da apresentação `visao`: as opcionais do Cliente só entram se alguma obra do filtro estiver marcada. */
function abasDaVisao(visao) {
  if (visao !== 'cliente') return ABAS;
  const filtradas = new Set(estado.filtro.obras ?? []);
  const marcadas = (campo) => (estado.bruto?.cadastro ?? []).some((c) => filtradas.has(c.chave) && c[campo] === 'sim');
  return ABAS.filter((a) => a.cliente !== 'opcional' || marcadas(a.opcaoCliente));
}

/** Papel Segurança não abre as apresentações: entra direto na Administração → Segurança do Trabalho. */
const veApresentacoes = () => pode(estado.usuario?.papel, 'ver');
const secoesPermitidas = () => SECOES_ADMIN.filter((s) => !s.dentroDe && pode(estado.usuario?.papel, s.capacidade));
const rotaInicial = () => (veApresentacoes() ? '/obra/inicio' : `/admin/${secoesPermitidas()[0]?.id ?? 'seguranca'}`);

// ── Rotas ────────────────────────────────────────────────────────────
for (const visao of ['obra', 'cliente']) {
  rota(`/${visao}/:aba`, ({ aba }) => {
    const encontrada = abasDaVisao(visao).find((a) => a.id === aba);
    // Aba opcional desligada para as obras do filtro (ex.: trocou a obra estando nela): volta à capa.
    if (!encontrada && ABAS.some((a) => a.id === aba)) return ir(`/${visao}/inicio`);
    return paginaApresentacao(visao, encontrada ?? ABAS[0]);
  });
  rota(`/${visao}/tela/:id`, ({ id }) => paginaApresentacao(visao, {
    id: `tela-${id}`, nome: 'Tela', render: (alvo) => renderTelaExtra(alvo, telasExtras.find((t) => t.id === id), visao),
  }));
}
rota('/admin/:secao', ({ secao }) => paginaAdmin(SECOES_ADMIN.find((s) => s.id === secao) ?? SECOES_ADMIN[0]));
rota('/conta', () => paginaSimples(renderConta));

// ── Shell ────────────────────────────────────────────────────────────
function cabecalho(visao, abaAtual) {
  const u = estado.usuario;
  const telas = telasDaVisao(visao);
  const apresentacoes = veApresentacoes();
  const admin = secoesPermitidas()[0];
  const link = (href, texto, atual) => h('a', { href: `#${href}`, 'aria-current': atual ? 'page' : null }, texto);
  const mesmaAba = (v) => (abasDaVisao(v).some((a) => a.id === abaAtual) ? abaAtual : 'inicio');
  return h('header', { class: 'app-header' }, h('div', { class: 'in' },
    h('a', { href: `#${rotaInicial()}`, 'aria-label': 'Início' }, h('img', { class: 'logo', src: 'assets/brand/logo-unita-white.png', alt: 'Unità Engenharia' })),
    visao ? h('nav', { 'aria-label': 'Abas da apresentação' },
      abasDaVisao(visao).map((a) => link(`/${visao}/${a.id}`, a.nome, a.id === abaAtual)),
      telas.map((t) => link(`/${visao}/tela/${t.id}`, t.titulo, abaAtual === `tela-${t.id}`))) : h('nav', {}),
    h('div', { class: 'direita' },
      apresentacoes ? h('div', { class: 'visao', role: 'group', 'aria-label': 'Apresentação' },
        h('a', { href: `#/obra/${mesmaAba('obra')}`, 'aria-current': String(visao === 'obra') }, 'Obra'),
        h('a', { href: `#/cliente/${mesmaAba('cliente')}`, 'aria-current': String(visao === 'cliente') }, 'Cliente')) : null,
      apresentacoes ? h('button', { class: 'btn inverse sm', type: 'button', title: 'Tela cheia', onclick: alternarApresentacao }, icone('telaCheia', { tamanho: 16 }), 'Apresentar') : null,
      apresentacoes && admin ? h('a', { class: 'btn inverse sm so-edicao', href: `#/admin/${admin.id}` }, icone('engrenagem', { tamanho: 16 }), 'Administração') : null,
      h('a', { class: 'usuario', href: '#/conta', style: { textDecoration: 'none' } }, h('b', {}, u.nome), h('span', {}, PAPEIS[u.papel]?.nome)),
      h('button', { class: 'btn inverse sm', type: 'button', onclick: sair, 'aria-label': 'Sair' }, icone('sair', { tamanho: 16 })))));
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
  if (!veApresentacoes()) return ir(rotaInicial());
  const conteudo = h('main', { class: `conteudo ${aba.capa ? 'cheio' : ''}`, id: 'conteudo' });
  const bloqueio = estadoDosDados();
  const base = estado.base(visao);
  montar(raiz, cabecalho(visao, aba.id), base && !aba.capa ? barraFiltros() : null, conteudo);
  if (estado.bruto?.aviso) conteudo.append(alerta('warning', 'Dados possivelmente desatualizados', estado.bruto.aviso));
  if (bloqueio || !base) return conteudo.append(bloqueio ?? carregando(8));
  const alvo = h('div');
  conteudo.append(alvo);
  try {
    await aba.render(alvo, { base, filtro: estado.filtro, visao, usuario: estado.usuario, abas: abasDaVisao(visao), telas: telasDaVisao(visao) });
  } catch (e) {
    console.error(e);
    montar(alvo, alerta('error', 'Erro ao montar a aba', e.message));
  }
}

async function paginaAdmin(secao) {
  if (!pode(estado.usuario.papel, secao.capacidade)) return ir(rotaInicial());
  const alvo = h('div', { class: 'painel-admin' });
  montar(raiz, cabecalho(null, null), h('main', { class: 'conteudo' }, h('div', { class: 'admin' },
    h('aside', {}, h('div', { class: 'eyebrow' }, 'Administração'), h('h3', {}, 'Conteúdo da apresentação'),
      h('nav', { 'aria-label': 'Seções' }, secoesPermitidas()
        .map((s) => h('a', { href: `#/admin/${s.id}`, 'aria-current': s.id === (secao.dentroDe ?? secao.id) ? 'page' : null }, s.nome)))),
    alvo)));
  const bloqueio = estadoDosDados();
  // Papel Segurança não carrega os dados das apresentações, só as obras do cadastro (estado.carregarObrasSeguranca).
  const pronto = veApresentacoes() ? estado.bruto : estado.obrasSeguranca;
  if (bloqueio || !pronto) return montar(alvo, bloqueio ?? carregando(6));
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
  if (!r) return ir(rotaInicial());
  r.tratador(r.params);
}

// ── Inicialização ────────────────────────────────────────────────────
async function iniciar() {
  const retorno = retornoDoEmail(); // link do convite / nova senha
  const aoEntrar = (usuario) => { estado.usuario = usuario; carregarTudo(); };
  montar(raiz, carregando(3));
  let sessao;
  try {
    sessao = await api.get('/auth/sessao');
  } catch (e) {
    return montar(raiz, h('main', { class: 'conteudo' }, alerta('error', 'Servidor indisponível', e.message)));
  }
  estado.convite = sessao.convite;
  if (retorno?.token) return renderDefinirSenha(raiz, { ...retorno, aoEntrar });
  if (!sessao.usuario) return renderLogin(raiz, { precisaConfigurar: sessao.precisaConfigurar, convite: sessao.convite, aviso: retorno?.erro, aoEntrar });
  estado.usuario = sessao.usuario;
  carregarTudo();
}

async function carregarTudo() {
  if (!caminhoAtual().startsWith('/') || caminhoAtual() === '/') ir(rotaInicial());
  desenhar();
  if (!veApresentacoes()) return estado.carregarObrasSeguranca();
  await Promise.all([estado.carregarDados(), carregarTelas()]);
  desenhar(); // as telas extras podem chegar depois dos dados: redesenha para o menu e a capa mostrarem
}

async function carregarTelas() {
  telasExtras = await api.get('/telas').catch(() => []);
}

estado.ouvir(() => { if (!estado.carregando || !estado.bruto) desenhar(); });
window.addEventListener('hashchange', () => {
  if (veApresentacoes() && /^\/(obra|cliente|admin\/telas)/.test(caminhoAtual())) carregarTelas().then(desenhar);
  else desenhar();
});
window.addEventListener('sessao-expirada', () => {
  if (!estado.usuario) return;
  estado.usuario = null;
  toast('warning', 'Sua sessão expirou', 'Entre novamente.');
  iniciar();
});

iniciar();
