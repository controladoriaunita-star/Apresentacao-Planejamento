/**
 * Abas "Tempo x Caminho" e "Acompanhamento Fotográfico": imagens cadastradas pelo Planejamento,
 * vinculadas a obra + mês, agrupadas por torre (TxC) ou local (fotos), com comentário.
 *
 * Layout: linha do tempo com os meses que têm imagens, abas de torre/local com contagem, palco escuro com
 * setas sobre a imagem, painel lateral com o comentário e miniaturas. Teclado: ← → navegam; "Ampliar"
 * abre a imagem em tela cheia.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtMes, fmtMesLongo } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { TIPOS_MIDIA } from '../domain/conteudo.js';
import { pode } from '../domain/permissoes.js';
import { alerta, badge, carregando, vazio } from '../ui/componentes.js';
import { obraUnica } from '../ui/filtros.js';
import { icone } from '../ui/icones.js';
import { abrirFormMidia } from './admin-midias.js';

const ICONE_TIPO = { txc: 'caminho', foto: 'camera' };

export async function renderGaleria(alvo, ctx, tipo) {
  const { base, filtro, visao } = ctx;
  const { obra, seletor } = obraUnica(base, () => renderGaleria(alvo, ctx, tipo));
  const def = TIPOS_MIDIA[tipo];
  if (!obra) return montar(alvo, vazio('Selecione uma obra no filtro'));

  const podeEditar = pode(estado.usuario?.papel, 'editarConteudo');
  const recarregar = () => renderGaleria(alvo, ctx, tipo);
  const titulo = h('div', { class: 'titulo-pagina' },
    h('div', { class: 'galeria-titulo' },
      h('span', { class: 'galeria-titulo-icone' }, icone(ICONE_TIPO[tipo], { tamanho: 22 })),
      h('div', {}, h('div', { class: 'eyebrow' }, def.nome), h('h1', {}, obra.nome))),
    h('div', { class: 'row' }, seletor,
      podeEditar ? h('button', { class: 'btn primary sm so-edicao', type: 'button', onclick: () => abrirFormMidia({ tipo, obra: obra.nome, mes: filtro.referencia }, recarregar) },
        icone('enviar', { tamanho: 16 }), `Cadastrar ${tipo === 'txc' ? 'TxC' : 'fotos'}`) : null));

  montar(alvo, titulo, carregando(3));
  let lista;
  try {
    lista = await api.get(`/midias?tipo=${tipo}&chaveObra=${encodeURIComponent(obra.chave)}`);
  } catch (e) {
    return montar(alvo, titulo, alerta('error', 'Não foi possível carregar as imagens', e.message));
  }
  if (visao === 'cliente') lista = lista.filter((m) => m.visivelCliente);

  const meses = [...new Set(lista.map((m) => m.mes))].sort().reverse(); // mais recente primeiro
  if (!meses.length) {
    return montar(alvo, titulo, h('div', { class: 'card' }, vazio(`Nenhuma imagem de ${def.nome.toLowerCase()} cadastrada`,
      podeEditar ? 'Use "Cadastrar" para enviar as imagens desta obra, por mês.' : 'O Planejamento ainda não cadastrou imagens para esta obra.')));
  }

  // Mês inicial: o de referência; se não houver imagens nele, o mais recente anterior (ou o mais recente).
  let mes = meses.includes(filtro.referencia) ? filtro.referencia : meses.find((m) => m <= filtro.referencia) ?? meses[0];
  let grupo = null;
  let indice = 0;

  const linhaTempo = h('div', { class: 'galeria-meses', role: 'tablist', 'aria-label': 'Meses com imagens' });
  const abasGrupo = h('div', { class: 'galeria-grupos', role: 'tablist', 'aria-label': def.grupo });
  const aviso = h('div');
  const palco = h('div', { class: 'galeria-palco' });
  const lateral = h('aside', { class: 'galeria-lateral card' });
  const miniaturas = h('div', { class: 'miniaturas', 'aria-label': 'Miniaturas' });

  const doMes = () => lista.filter((m) => m.mes === mes).sort((a, b) => a.ordem - b.ordem || String(a.grupo).localeCompare(String(b.grupo)));
  const itensAtuais = () => doMes().filter((m) => (m.grupo ?? 'Geral') === grupo);

  const ir = (novoIndice) => {
    const itens = itensAtuais();
    indice = Math.max(0, Math.min(itens.length - 1, novoIndice));
    desenhar();
  };

  const desenhar = () => {
    const todosDoMes = doMes();
    const grupos = [...new Set(todosDoMes.map((m) => m.grupo ?? 'Geral'))];
    if (!grupos.includes(grupo)) { grupo = grupos[0]; indice = 0; }
    const itens = itensAtuais();
    const atual = itens[indice];

    montar(linhaTempo, meses.map((m) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(m === mes), class: m === filtro.referencia ? 'referencia' : '',
      title: m === filtro.referencia ? 'Mês de referência' : null,
      onclick: () => { mes = m; grupo = null; indice = 0; desenhar(); },
    }, fmtMes(m), h('small', {}, `${lista.filter((x) => x.mes === m).length}`))));

    abasGrupo.classList.toggle('oculto', grupos.length < 2);
    montar(abasGrupo, grupos.map((g) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(g === grupo),
      onclick: () => { grupo = g; indice = 0; desenhar(); },
    }, g, h('span', { class: 'contador' }, todosDoMes.filter((m) => (m.grupo ?? 'Geral') === g).length))));

    montar(aviso, mes !== filtro.referencia && !meses.includes(filtro.referencia)
      ? alerta('info', `Sem imagens em ${fmtMes(filtro.referencia)}`, `Exibindo ${fmtMesLongo(mes)}. Escolha outro mês na linha do tempo.`)
      : null);

    const descricao = `${def.nome} — ${obra.nome}${atual.grupo ? ` — ${atual.grupo}` : ''} — ${fmtMes(mes)}`;
    montar(palco,
      h('img', { src: api.urlArquivo(atual.arquivoId), alt: descricao }),
      itens.length > 1 ? h('button', { class: 'galeria-seta esquerda', type: 'button', 'aria-label': 'Imagem anterior', disabled: indice === 0, onclick: () => ir(indice - 1) }, icone('direita', { tamanho: 22 })) : null,
      itens.length > 1 ? h('button', { class: 'galeria-seta direita', type: 'button', 'aria-label': 'Próxima imagem', disabled: indice === itens.length - 1, onclick: () => ir(indice + 1) }, icone('direita', { tamanho: 22 })) : null,
      h('div', { class: 'galeria-palco-topo' },
        h('span', { class: 'galeria-contagem tab' }, `${indice + 1} / ${itens.length}`),
        h('button', { class: 'galeria-ampliar', type: 'button', onclick: () => ampliar(atual, descricao) }, icone('telaCheia', { tamanho: 16 }), 'Ampliar')));

    montar(lateral,
      h('div', { class: 'galeria-info' },
        h('p', { class: 'sub' }, def.grupo),
        h('h3', {}, atual.grupo ?? 'Geral'),
        h('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } },
          badge(fmtMesLongo(mes), 'primary'),
          visao === 'obra' && !atual.visivelCliente ? badge('Oculta para o cliente', 'neutral') : null)),
      h('div', { class: 'galeria-comentario' },
        h('p', { class: 'sub' }, 'Comentário'),
        atual.comentario ? h('p', {}, atual.comentario) : h('p', { class: 'muted' }, 'Sem comentário para esta imagem.')),
      h('p', { class: 'muted small galeria-dica' }, icone('direita', { tamanho: 14 }), 'Use as setas ← → do teclado para navegar.'));

    miniaturas.classList.toggle('oculto', itens.length < 2);
    montar(miniaturas, itens.map((m, i) => h('button', {
      type: 'button', 'aria-current': String(i === indice), 'aria-label': `Imagem ${i + 1}${m.grupo ? ` — ${m.grupo}` : ''}`, onclick: () => ir(i),
    }, h('img', { src: api.urlArquivo(m.arquivoId), alt: '', loading: 'lazy' }))));
  };

  // Teclado: ← → navegam (só enquanto esta página estiver na tela e sem modal aberto).
  const teclado = (e) => {
    if (!palco.isConnected) return document.removeEventListener('keydown', teclado);
    if (document.querySelector('.modal-fundo, .visor, .ficha') || /input|textarea|select/i.test(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight') ir(indice + 1);
    if (e.key === 'ArrowLeft') ir(indice - 1);
  };
  document.addEventListener('keydown', teclado);

  desenhar();
  montar(alvo,
    titulo,
    h('div', { class: 'galeria-barra' }, h('span', { class: 'sub' }, 'Meses'), linhaTempo),
    aviso,
    abasGrupo,
    h('div', { class: 'galeria' }, h('div', { class: 'galeria-principal' }, palco, miniaturas), lateral));
}

/** Imagem em tela cheia (fecha com Esc, clique ou botão). */
function ampliar(midia, descricao) {
  const fechar = () => { visor.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  const visor = h('div', { class: 'visor', role: 'dialog', 'aria-modal': 'true', 'aria-label': descricao, onclick: (e) => { if (e.target === visor) fechar(); } },
    h('img', { src: api.urlArquivo(midia.arquivoId), alt: descricao }),
    h('div', { class: 'visor-legenda' }, h('b', {}, descricao), midia.comentario ? h('span', {}, midia.comentario) : null),
    h('button', { class: 'btn inverse visor-fechar', type: 'button', onclick: fechar }, icone('x', { tamanho: 18 }), 'Fechar'));
  document.addEventListener('keydown', tecla);
  document.body.append(visor);
  visor.querySelector('.visor-fechar').focus();
}
