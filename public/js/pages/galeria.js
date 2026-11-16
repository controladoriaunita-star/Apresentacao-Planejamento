/**
 * Abas "Tempo x Caminho" e "Acompanhamento Fotográfico": imagens cadastradas pelo Planejamento,
 * vinculadas a obra + mês, agrupadas por torre (TxC) ou local (fotos), com comentário.
 *
 * Layout: linha do tempo com os meses que têm imagens, abas de torre/local com contagem, palco escuro com
 * setas sobre a imagem, painel lateral com o comentário e miniaturas. Teclado: ← → navegam; "Ampliar"
 * abre a imagem em tela cheia.
 *
 * v29 — A imagem sempre aparece inteira no palco (ajustada ao espaço, sem cortes). Em tela cheia também dá para
 * ir à anterior/próxima (setas e ← →) sem fechar, e o botão "Zoom" (ou duplo clique) amplia para ver detalhes,
 * arrastando para mover. Ao fechar, o palco fica na última imagem vista.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtMes, fmtMesLongo } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { TIPOS_MIDIA, midiasDaVisao } from '../domain/conteudo.js';
import { pode } from '../domain/permissoes.js';
import { alerta, badge, carregando, vazio } from '../ui/componentes.js';
import { obraUnica } from '../ui/filtros.js';
import { icone } from '../ui/icones.js';
import { abrirFormMidia } from './admin-midias.js';

const ICONE_TIPO = { txc: 'caminho', foto: 'camera' };

/**
 * Mês exibido (também no PDF): o de referência; se não houver imagens nele, o mais recente anterior
 * (ou o mais recente). `meses` em ordem decrescente.
 */
export const mesExibido = (meses, referencia) => (meses.includes(referencia) ? referencia : meses.find((m) => m <= referencia) ?? meses[0]);

export async function renderGaleria(alvo, ctx, tipo) {
  const { base, filtro, visao } = ctx;
  const { obra, seletor } = obraUnica(base, () => renderGaleria(alvo, ctx, tipo), filtro);
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
  lista = midiasDaVisao(lista, visao);

  const meses = [...new Set(lista.map((m) => m.mes))].sort().reverse(); // mais recente primeiro
  if (!meses.length) {
    return montar(alvo, titulo, h('div', { class: 'card' }, vazio(`Nenhuma imagem de ${def.nome.toLowerCase()} cadastrada`,
      podeEditar ? 'Use "Cadastrar" para enviar as imagens desta obra, por mês.' : 'O Planejamento ainda não cadastrou imagens para esta obra.')));
  }

  let mes = mesExibido(meses, filtro.referencia);
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

    const descricaoDe = (m) => `${def.nome} — ${obra.nome}${m.grupo ? ` — ${m.grupo}` : ''} — ${fmtMes(mes)}`;
    const descricao = descricaoDe(atual);
    montar(palco,
      h('img', { src: api.urlArquivo(atual.arquivoId), alt: descricao }),
      itens.length > 1 ? h('button', { class: 'galeria-seta esquerda', type: 'button', 'aria-label': 'Imagem anterior', disabled: indice === 0, onclick: () => ir(indice - 1) }, icone('direita', { tamanho: 22 })) : null,
      itens.length > 1 ? h('button', { class: 'galeria-seta direita', type: 'button', 'aria-label': 'Próxima imagem', disabled: indice === itens.length - 1, onclick: () => ir(indice + 1) }, icone('direita', { tamanho: 22 })) : null,
      h('div', { class: 'galeria-palco-topo' },
        h('span', { class: 'galeria-contagem tab' }, `${indice + 1} / ${itens.length}`),
        h('button', { class: 'galeria-ampliar', type: 'button', onclick: () => ampliar({ itens, indice, descricaoDe, aoMudar: ir }) }, icone('telaCheia', { tamanho: 16 }), 'Ampliar')));

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

/**
 * Imagem em tela cheia com navegação (v29): setas e ← → vão à anterior/próxima sem fechar; "Zoom" ou duplo
 * clique amplia (arraste ou role para mover); Esc, clique fora ou "Fechar" saem. `aoMudar(i)` deixa o palco
 * da página na mesma imagem.
 * @param {{ itens: object[], indice: number, descricaoDe: (m: object) => string, aoMudar: (i: number) => void }} opcoes
 */
function ampliar({ itens, indice: inicial, descricaoDe, aoMudar }) {
  let indice = inicial;
  let zoom = false;
  const area = h('div', { class: 'visor-area' });
  const legenda = h('div', { class: 'visor-legenda' });
  const contagem = h('span', { class: 'galeria-contagem tab' });
  const anterior = h('button', { class: 'galeria-seta esquerda', type: 'button', 'aria-label': 'Imagem anterior', onclick: () => ir(indice - 1) }, icone('direita', { tamanho: 22 }));
  const proxima = h('button', { class: 'galeria-seta direita', type: 'button', 'aria-label': 'Próxima imagem', onclick: () => ir(indice + 1) }, icone('direita', { tamanho: 22 }));
  const botaoZoom = h('button', { class: 'btn inverse visor-zoom', type: 'button', 'aria-pressed': 'false', onclick: () => alternarZoom() });

  const alternarZoom = (ligar = !zoom, ponto = null) => {
    zoom = ligar;
    visor.classList.toggle('com-zoom', zoom);
    botaoZoom.setAttribute('aria-pressed', String(zoom));
    montar(botaoZoom, icone(zoom ? 'zoomMenos' : 'zoomMais', { tamanho: 18 }), zoom ? 'Ajustar à tela' : 'Zoom');
    if (zoom) { // centraliza no ponto clicado (ou no meio da imagem)
      const img = area.querySelector('img');
      const fx = ponto ? ponto.x : 0.5;
      const fy = ponto ? ponto.y : 0.5;
      requestAnimationFrame(() => area.scrollTo(img.offsetWidth * fx - area.clientWidth / 2, img.offsetHeight * fy - area.clientHeight / 2));
    }
  };
  const ir = (novo) => {
    if (novo < 0 || novo >= itens.length) return;
    indice = novo;
    aoMudar(indice);
    desenhar();
  };
  const desenhar = () => {
    const m = itens[indice];
    const descricao = descricaoDe(m);
    visor.setAttribute('aria-label', descricao);
    const img = h('img', {
      src: api.urlArquivo(m.arquivoId), alt: descricao, draggable: false,
      ondblclick: (e) => { const r = e.target.getBoundingClientRect(); alternarZoom(!zoom, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); },
    });
    montar(area, img);
    montar(legenda, h('b', {}, descricao), m.comentario ? h('span', {}, m.comentario) : null);
    contagem.textContent = `${indice + 1} / ${itens.length}`;
    anterior.disabled = indice === 0;
    proxima.disabled = indice === itens.length - 1;
    alternarZoom(false);
  };

  // Arrastar para mover a imagem ampliada.
  let arrasto = null;
  area.addEventListener('pointerdown', (e) => {
    if (!zoom || e.button !== 0) return;
    arrasto = { x: e.clientX, y: e.clientY, l: area.scrollLeft, t: area.scrollTop };
    area.setPointerCapture(e.pointerId);
    area.classList.add('arrastando');
  });
  area.addEventListener('pointermove', (e) => {
    if (!arrasto) return;
    area.scrollLeft = arrasto.l - (e.clientX - arrasto.x);
    area.scrollTop = arrasto.t - (e.clientY - arrasto.y);
  });
  const soltar = () => { arrasto = null; area.classList.remove('arrastando'); };
  area.addEventListener('pointerup', soltar);
  area.addEventListener('pointercancel', soltar);

  const fechar = () => { visor.remove(); document.removeEventListener('keydown', tecla); };
  // Com o visor aberto, o teclado da página ignora as setas (ela checa `.visor`): só este navega.
  const tecla = (e) => {
    if (e.key === 'Escape') fechar();
    else if (e.key === 'ArrowRight') { e.preventDefault(); ir(indice + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(indice - 1); }
  };
  const visor = h('div', { class: 'visor', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target === visor || (e.target === area && !zoom)) fechar(); } },
    area,
    itens.length > 1 ? [anterior, proxima] : null,
    h('div', { class: 'visor-topo' }, contagem, h('div', { class: 'row' }, botaoZoom,
      h('button', { class: 'btn inverse visor-fechar', type: 'button', onclick: fechar }, icone('x', { tamanho: 18 }), 'Fechar'))),
    legenda);
  document.addEventListener('keydown', tecla);
  document.body.append(visor);
  desenhar();
  visor.querySelector('.visor-fechar').focus();
}
