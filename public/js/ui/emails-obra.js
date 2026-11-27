/**
 * E-mails das pessoas de cada obra (guardados no Cadastro de obras): entram em cópia no envio da IAT e da IST.
 * Usado em Administração → Cadastro de obras (Dev, Planejamento) e em Segurança do Trabalho → "E-mails das obras"
 * (também o papel Segurança, que não abre o Cadastro de obras).
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { emailValido } from '../domain/cadastro-obra.js';
import { abrirModal, botaoAcao, toast } from './componentes.js';

const contagem = (cadastro) => h('span', { class: `badge ${cadastro.emails?.length ? 'b-primary' : 'b-neutral'}` }, String(cadastro.emails?.length ?? 0));

/** Diálogo para incluir/remover os e-mails de uma obra. `aoSalvar(emails)` roda depois de gravar. */
export function abrirEmailsObra(cadastro, aoSalvar) {
  let emails = [...(cadastro.emails ?? [])];
  const erro = h('small', { class: 'err' });
  const entrada = h('input', { type: 'email', placeholder: 'nome@empresa.com.br', autocomplete: 'off', 'aria-label': 'Novo e-mail' });
  const lista = h('tbody');
  const total = h('span', { class: 'muted' });
  const desenhar = () => {
    total.textContent = `${emails.length} e-mail(s)`;
    montar(lista, emails.length
      ? emails.map((e, i) => h('tr', {}, h('td', {}, e),
        h('td', { class: 'acoes' }, h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': `Remover ${e}`, onclick: () => { emails.splice(i, 1); desenhar(); } }, 'Remover'))))
      : h('tr', {}, h('td', { class: 'vazio-emails', colspan: 2 }, 'Nenhum e-mail cadastrado.')));
  };
  const incluir = () => {
    const e = entrada.value.trim().toLowerCase();
    erro.textContent = '';
    if (!e) return;
    if (!emailValido(e)) { erro.textContent = 'Informe um e-mail válido (nome@empresa.com.br).'; return; }
    if (emails.includes(e)) { erro.textContent = 'Este e-mail já está na lista.'; return; }
    emails.push(e);
    entrada.value = '';
    desenhar();
    entrada.focus();
  };
  entrada.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); incluir(); } });
  desenhar();
  const m = abrirModal({
    titulo: `E-mails da obra · ${cadastro.obra}`,
    conteudo: h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'Estes e-mails recebem a IAT e a IST desta obra (PDF e ficha no corpo do e-mail).'),
      h('label', { class: 'field' }, h('span', {}, 'Novo e-mail'),
        h('div', { class: 'row emails-novo' }, entrada, h('button', { class: 'btn secondary', type: 'button', onclick: incluir }, 'Incluir')), erro),
      h('div', { class: 'sheet emails-lista' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'E-mail'), h('th', {}))), lista))),
    acoes: [
      total,
      h('span', { class: 'emails-espaco' }),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      botaoAcao('Salvar e-mails', async () => {
        if (entrada.value.trim()) incluir(); // e-mail digitado e não incluído também entra
        if (erro.textContent) return;
        try {
          const salvo = await api.put(`/obras/cadastro/${cadastro.id}/emails`, { emails });
          m.fechar();
          toast('success', 'E-mails salvos', `${emails.length} e-mail(s) em ${cadastro.obra}.`);
          await aoSalvar(salvo?.emails ?? emails);
        } catch (err) {
          toast('error', 'Não foi possível salvar os e-mails', err.message);
        }
      }, 'btn primary'),
    ],
  });
}

/** Botão "Cadastrar e-mails" com a contagem, como na tabela do Cadastro de obras. */
export const botaoEmailsObra = (cadastro, aoSalvar) => h('button', {
  class: 'btn secondary sm btn-emails', type: 'button', onclick: () => abrirEmailsObra(cadastro, aoSalvar),
}, 'Cadastrar e-mails', contagem(cadastro));

/**
 * Lista de obras com a contagem de e-mails (Segurança do Trabalho → "E-mails das obras").
 * Escolher uma obra fecha a lista e abre o diálogo dela. `aoSalvar` recarrega as obras na tela.
 */
export function abrirEmailsDasObras(cadastros, aoSalvar) {
  const busca = h('input', { type: 'search', placeholder: 'Buscar obra ou cliente', autocomplete: 'off', 'aria-label': 'Buscar obra' });
  const corpo = h('tbody');
  const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const desenhar = () => {
    const termo = semAcento(busca.value.trim());
    const visiveis = cadastros.filter((c) => !termo || semAcento(`${c.obra} ${c.cliente ?? ''}`).includes(termo));
    montar(corpo, visiveis.length
      ? visiveis.map((c) => h('tr', {},
        h('td', { class: 'first' }, c.obra),
        h('td', { class: 'esq' }, c.cliente ?? '—'),
        h('td', { class: 'esq' }, h('button', {
          class: 'btn secondary sm btn-emails', type: 'button',
          onclick: () => { m.fechar(); abrirEmailsObra(c, aoSalvar); },
        }, 'Cadastrar e-mails', contagem(c)))))
      : h('tr', {}, h('td', { class: 'vazio-emails', colspan: 3 }, 'Nenhuma obra encontrada.')));
  };
  busca.addEventListener('input', desenhar);
  desenhar();
  const m = abrirModal({
    titulo: 'E-mails das obras',
    largo: true,
    conteudo: h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'Os e-mails de cada obra entram em cópia quando a IAT e a IST dela são enviadas.'),
      busca,
      h('div', { class: 'sheet emails-lista' }, h('table', { class: 'lista-admin' },
        h('thead', {}, h('tr', {}, h('th', { class: 'first' }, 'Obra'), h('th', {}, 'Cliente'), h('th', {}, 'E-mails da obra'))),
        corpo))),
    acoes: [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Fechar')],
  });
}
