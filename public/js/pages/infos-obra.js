/**
 * Ficha da obra ("+ Infos da obra"), em tela cheia: cabeçalho com a marca, destaques numéricos,
 * equipe, características, linha do tempo dos prazos e orçamento/INCC. Os dados vêm do cadastro de
 * obras (Administração → Cadastro de obras) e o avanço físico das planilhas.
 */
import { h } from '../core/dom.js';
import { fmtData, fmtMesLongo, fmtMoeda, fmtNumero, fmtPercentual, VAZIO } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { pode } from '../domain/permissoes.js';
import { ultimoMesFechado } from '../domain/periodo.js';
import { badge, vazio } from '../ui/componentes.js';
import { icone } from '../ui/icones.js';

const SITUACAO = { ativa: ['Ativa', 'success'], concluida: ['Concluída', 'info'], paralisada: ['Paralisada', 'warning'] };

const tem = (v) => v !== null && v !== undefined && v !== '';
const num = (v, casas) => (tem(v) ? fmtNumero(v, casas ?? (Number.isInteger(v) ? 0 : 2)) : VAZIO);
const iniciais = (nome) => String(nome).split(/[\s/]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export function abrirInfosObra(base, chave) {
  const obra = base.obras.find((o) => o.chave === chave);
  const c = base.cadastro.get(chave) ?? null;
  const anterior = document.activeElement;

  const fechar = () => {
    painel.remove();
    document.removeEventListener('keydown', teclado);
    document.body.classList.remove('sem-rolagem');
    anterior?.focus?.();
  };
  const teclado = (e) => { if (e.key === 'Escape') fechar(); };

  const botaoFechar = h('button', { class: 'btn inverse', type: 'button', onclick: fechar }, icone('x', { tamanho: 18 }), 'Fechar');
  const painel = h('div', { class: 'ficha', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Informações da obra ${obra?.nome ?? ''}` },
    cabecalho(obra, c, base, botaoFechar),
    h('div', { class: 'ficha-corpo' }, c ? corpo(c, base, chave) : semCadastro(fechar)));

  document.addEventListener('keydown', teclado);
  document.body.classList.add('sem-rolagem');
  document.body.append(painel);
  botaoFechar.focus();
}

function cabecalho(obra, c, base, botaoFechar) {
  const situacao = SITUACAO[c?.situacao];
  const local = [c?.bairro, c?.cidade].filter(tem).join(' · ');
  return h('header', { class: 'ficha-topo' },
    h('img', { class: 'ficha-padrao', src: 'assets/brand/pattern-un.png', alt: '', 'aria-hidden': 'true' }),
    h('div', { class: 'ficha-topo-in' },
      h('div', { class: 'ficha-barra' },
        h('img', { class: 'ficha-logo', src: 'assets/brand/logo-unita-white.png', alt: 'Unità Engenharia' }),
        botaoFechar),
      h('div', { class: 'ficha-identidade' },
        h('div', { class: 'eyebrow' }, c?.cliente ?? obra?.cliente ?? 'Obra'),
        h('h1', {}, obra?.nome ?? c?.obra ?? 'Obra'),
        h('div', { class: 'ficha-chips' },
          tem(c?.endereco) ? h('span', { class: 'ficha-chip' }, icone('local', { tamanho: 15 }), c.endereco, local ? ` — ${local}` : '') : null,
          tem(c?.uau ?? obra?.uau) ? h('span', { class: 'ficha-chip' }, `Nº UAU ${c?.uau ?? obra?.uau}`) : null,
          situacao ? badge(situacao[0], situacao[1]) : null))));
}

function corpo(c, base, chave) {
  const ultimo = ultimoMesFechado(base, chave, estado.filtro.referencia);
  const avanco = ultimo ? base.infos.get(chave)?.get(ultimo)?.realizadoAcm : null;

  const destaques = [
    ['Avanço físico', fmtPercentual(avanco, 1), ultimo ? `até ${fmtMesLongo(ultimo)}` : 'sem fechamento', 'fisico', 'laranja'],
    ['Unidades (UH)', num(c.numeroUH), tem(c.unidadesHabitaveis) ? `${num(c.unidadesHabitaveis)} habitáveis` : null, 'predio', 'grafite'],
    ['Área equivalente', tem(c.areaEquivalente) ? `${num(c.areaEquivalente)} m²` : VAZIO, tem(c.coeficienteAEq) ? `AE/AP ${num(c.coeficienteAEq, 2)}` : null, 'regua', 'azul'],
    ['Área privativa', tem(c.areaPrivativaTotal) ? `${num(c.areaPrivativaTotal)} m²` : VAZIO, tem(c.areaPrivativaMedia) ? `${num(c.areaPrivativaMedia)} m² por UH` : null, 'regua', 'verde'],
    ['Área construída', tem(c.areaConstruida) ? `${num(c.areaConstruida)} m²` : VAZIO, tem(c.areaTerreno) ? `terreno ${num(c.areaTerreno)} m²` : null, 'predio', 'laranja'],
    ['Torres', num(c.numeroTorres), tem(c.temBanda) ? `banda ${num(c.temBanda, 2)}` : null, 'predio', 'grafite'],
  ];

  const equipe = [['Diretoria', c.diretoria], ['Gestão', c.gestao], ['Coordenação', c.coordenador], ['Engenharia', c.engenharia], ['Planejamento', c.planejamento]].filter(([, v]) => tem(v));
  const caracteristicas = [['Tipologia', c.tipologia], ['Padrão', c.padrao], ['Sistema estrutural', c.sistemaEstrutural], ['Fundação', c.fundacao]].filter(([, v]) => tem(v));
  const prazos = [
    ['Início da obra', c.inicioObra, 'inicio'],
    ['Fim — meta da obra', c.fimObraMeta, 'meta'],
    ['Fim — cliente final', c.fimObraCliente, ''],
    ['Fim — incorporador', c.fimObraIncorporador, ''],
  ].filter(([, d]) => tem(d)).sort((a, b) => a[1].localeCompare(b[1]));

  return [
    h('div', { class: 'ficha-destaques' }, destaques.map(([rotulo, valor, detalhe, ic, cor]) => h('div', { class: `ficha-destaque cor-${cor}` },
      h('span', { class: 'ficha-destaque-icone' }, icone(ic, { tamanho: 22 })),
      h('div', {}, h('span', { class: 'rotulo' }, rotulo), h('b', { class: 'tab' }, valor), detalhe ? h('small', {}, detalhe) : null)))),

    h('div', { class: 'ficha-grade' },
      secao('Equipe', 'pessoas', 'laranja', equipe.length
        ? h('ul', { class: 'ficha-equipe' }, equipe.map(([papel, nome]) => h('li', {},
          h('span', { class: 'avatar' }, iniciais(nome)), h('div', {}, h('small', {}, papel), h('b', {}, nome)))))
        : nada()),

      secao('Características', 'fisico', 'azul', caracteristicas.length
        ? h('dl', { class: 'ficha-pares' }, caracteristicas.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v))))
        : nada()),

      secao('Prazos', 'relogio', 'verde', prazos.length
        ? h('div', {},
          h('ol', { class: 'ficha-linha-tempo' }, prazos.map(([rotulo, data, tipo]) => h('li', { class: tipo },
            h('span', { class: 'marco' }), h('div', {}, h('small', {}, rotulo), h('b', {}, fmtData(data)))))),
          tem(c.prazoInicial) || tem(c.prazoMeta)
            ? h('p', { class: 'ficha-nota' }, `Prazo inicial ${num(c.prazoInicial)} meses · meta ${num(c.prazoMeta)} meses`)
            : null)
        : nada()),

      secao('Orçamento e INCC', 'economico', 'grafite', h('dl', { class: 'ficha-pares' },
        h('div', {}, h('dt', {}, 'Orçamento base'), h('dd', {}, tem(c.orcamentoBase) ? fmtMoeda(c.orcamentoBase) : VAZIO)),
        h('div', {}, h('dt', {}, 'Mês do orçamento'), h('dd', {}, tem(c.mesOrcamento) ? fmtMesLongo(c.mesOrcamento.slice(0, 7)) : VAZIO)),
        h('div', {}, h('dt', {}, 'INCC do orçamento'), h('dd', {}, num(c.inccBase, 3))),
        h('div', {}, h('dt', {}, 'Data-base INCC'), h('dd', {}, fmtData(c.dataBaseIncc)))))),

    h('p', { class: 'ficha-rodape muted small' }, `Cadastro atualizado em ${c.atualizadoEm ? new Date(c.atualizadoEm).toLocaleString('pt-BR') : VAZIO}${c.atualizadoPor ? ` por ${c.atualizadoPor}` : ''}.`),
  ];
}

function secao(titulo, ic, cor, conteudo) {
  return h('section', { class: `card ficha-secao cor-${cor}` },
    h('div', { class: 'ficha-secao-titulo' }, h('span', { class: 'ficha-secao-icone' }, icone(ic, { tamanho: 18 })), h('h3', {}, titulo)),
    conteudo);
}

const nada = () => h('p', { class: 'muted' }, 'Não informado no cadastro.');

function semCadastro(fechar) {
  const podeEditar = pode(estado.usuario?.papel, 'editarConteudo');
  return h('div', { class: 'card' }, vazio('Obra sem cadastro',
    podeEditar ? 'Preencha em Administração → Cadastro de obras (Nº de UH, áreas, equipe, prazos e INCC).' : 'O Planejamento ainda não cadastrou as informações desta obra.',
    podeEditar ? h('a', { class: 'btn primary sm', href: '#/admin/cadastro-obras', onclick: fechar }, 'Abrir cadastro de obras') : null));
}
