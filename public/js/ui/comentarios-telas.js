/**
 * v29 — Comentários por tela: botão "Comentários" na barra de filtros (só equipe interna: Dev e Planejamento)
 * que abre um painel lateral com as anotações da obra, do mês de referência e da tela atuais. O Dev escreve e
 * apaga; o Planejamento só lê. Não aparecem para o Viewer nem no PDF. Regras em domain/comentarios-telas.js.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { estado } from '../core/estado.js';
import { fmtDataHora, fmtMesLongo } from '../core/formato.js';
import { comentariosDaTela, MAX_TEXTO } from '../domain/comentarios-telas.js';
import { pode } from '../domain/permissoes.js';
import { alerta, badge, botaoAcao, toast, vazio } from './componentes.js';
import { icone } from './icones.js';

/** Abas que mostram uma obra só (seletor "Obra exibida"): o comentário vai para a obra exibida. */
const ABAS_DE_UMA_OBRA = new Set(['resumo-fisico', 'resumo-economico', 'tempo-caminho', 'fotos']);

/** Obra dos comentários: a única do filtro ou, nas abas de uma obra, a exibida; com várias obras, nenhuma. */
function obraAtual(abaId) {
  const { obras, obraUnica } = estado.filtro;
  if (obras.length === 1) return obras[0];
  if (ABAS_DE_UMA_OBRA.has(abaId)) return obras.includes(obraUnica) ? obraUnica : obras[0] ?? null;
  return null;
}

const consulta = (obra, mes) => `obra=${encodeURIComponent(obra)}&mes=${encodeURIComponent(mes)}`;

/**
 * Botão da barra de filtros (null para quem não é da equipe interna).
 * @param {{ visao: 'obra'|'cliente', aba: { id: string, nome: string } }} opcoes
 */
export function botaoComentarios({ visao, aba }) {
  if (!pode(estado.usuario?.papel, 'editarConteudo')) return null;
  const contador = h('span', { class: 'comentarios-contador oculto' });
  const botao = h('button', {
    class: 'btn ghost sm so-edicao', type: 'button', 'data-teste': 'comentarios-tela',
    title: 'Anotações da equipe sobre esta tela no mês (não aparecem para o cliente)',
    onclick: () => abrirPainel({ visao, aba, aoMudar: atualizarContador }),
  }, icone('texto', { tamanho: 16 }), 'Comentários', contador);
  async function atualizarContador() {
    const obra = obraAtual(aba.id);
    const mes = estado.filtro.referencia;
    if (!obra || !mes) return contador.classList.add('oculto');
    try {
      const { comentarios } = await api.get(`/comentarios-telas?${consulta(obra, mes)}`);
      const n = comentariosDaTela(comentarios, aba.id).length;
      contador.textContent = String(n);
      contador.classList.toggle('oculto', n === 0);
    } catch { contador.classList.add('oculto'); }
  }
  atualizarContador();
  return botao;
}

function abrirPainel({ visao, aba, aoMudar }) {
  document.querySelector('.comentarios-painel')?.remove();
  const anterior = document.activeElement;
  const ehDev = pode(estado.usuario?.papel, 'administrar');
  const obra = obraAtual(aba.id);
  const mes = estado.filtro.referencia;
  const nomeObra = estado.base(visao)?.obras.find((o) => o.chave === obra)?.nome ?? obra;
  const lista = h('div', { class: 'comentarios-lista', 'aria-live': 'polite' });

  const fechar = () => {
    painel.remove();
    document.removeEventListener('keydown', tecla);
    aoMudar();
    anterior?.focus?.();
  };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };

  const carregar = async () => {
    montar(lista, h('p', { class: 'muted small' }, 'Carregando…'));
    try {
      const { comentarios } = await api.get(`/comentarios-telas?${consulta(obra, mes)}`);
      const daTela = comentariosDaTela(comentarios, aba.id);
      montar(lista, daTela.length ? daTela.map(item) : vazio('Nenhum comentário nesta tela no mês', ehDev ? 'Escreva abaixo o que foi pontuado.' : null));
    } catch (e) {
      montar(lista, alerta('error', 'Não foi possível carregar os comentários', e.message));
    }
  };
  const item = (c) => h('article', { class: 'comentario-tela' },
    h('div', { class: 'comentario-tela-topo' },
      h('b', {}, c.autor ?? c.email ?? 'Dev'),
      h('span', { class: 'muted small' }, fmtDataHora(c.criadoEm)),
      badge(c.visao === 'cliente' ? 'Cliente' : 'Obra', 'neutral'),
      ehDev ? h('button', {
        class: 'btn ghost sm comentario-apagar', type: 'button', 'aria-label': 'Apagar comentário',
        onclick: async () => {
          if (!window.confirm('Apagar este comentário? Não dá para desfazer.')) return;
          try {
            await api.del(`/comentarios-telas/${encodeURIComponent(c.id)}?${consulta(obra, mes)}`);
            carregar();
          } catch (e) { toast('error', 'Não foi possível apagar', e.message); }
        },
      }, icone('x', { tamanho: 14 })) : null),
    h('p', {}, c.texto));

  const texto = h('textarea', { rows: 4, maxlength: MAX_TEXTO, placeholder: 'O que foi pontuado nesta tela…', 'aria-label': 'Novo comentário' });
  const formulario = ehDev ? h('div', { class: 'comentarios-novo' },
    texto,
    botaoAcao('Salvar comentário', async () => {
      if (!texto.value.trim()) return toast('warning', 'Escreva o comentário');
      try {
        await api.post('/comentarios-telas', { obra, mes, tela: aba.id, visao, texto: texto.value });
        texto.value = '';
        carregar();
      } catch (e) { toast('error', 'Não foi possível salvar', e.message); }
    }, 'btn primary sm')) : null;

  const painel = h('aside', { class: 'comentarios-painel', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Comentários da tela', 'data-teste': 'painel-comentarios' },
    h('div', { class: 'comentarios-topo' },
      h('div', {}, h('p', { class: 'eyebrow' }, 'Comentários da equipe'), h('h3', {}, aba.nome),
        h('p', { class: 'muted small' }, obra ? `${nomeObra} · ${fmtMesLongo(mes)}` : '')),
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Fechar comentários', onclick: fechar }, icone('x', { tamanho: 16 }))),
    h('p', { class: 'comentarios-aviso small' }, 'Só a equipe interna vê. Não aparecem para o cliente nem no PDF.'),
    obra ? [lista, formulario] : alerta('info', 'Selecione uma única obra', 'Os comentários são gravados por obra: deixe uma obra só no filtro.'));
  document.addEventListener('keydown', tecla);
  document.body.append(painel);
  if (obra) carregar();
  (formulario ? texto : painel.querySelector('button')).focus();
}
