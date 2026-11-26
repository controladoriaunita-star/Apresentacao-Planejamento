/**
 * Peças comuns das telas de IAT e IST: campo conforme o tipo (lista suspensa, data, tabela do eSocial com busca…),
 * espaço de foto, anexo em PDF, sub-abas e barra de ações.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { descricaoTabela, FIXOS_IAT, SIM_NAO, TABELAS_IAT } from '../domain/informativos.js';
import { buscaLista } from './busca-lista.js';
import { campo, toast } from './componentes.js';
import { icone } from './icones.js';

/** Opções de um <select>; a primeira vazia permite deixar em branco. */
const opcoesSelect = (lista, atual, vazioTexto = 'Selecione') => [
  h('option', { value: '', selected: !atual }, vazioTexto),
  ...lista.map((o) => (Array.isArray(o) ? h('option', { value: o[0], selected: o[0] === atual }, o[1]) : h('option', { value: o, selected: o === atual }, o))),
];

/**
 * Campo do formulário. `doc[def.id]` é lido e atualizado direto; `aoMudar(id, valor)` avisa a tela.
 * @param {{cadastros?: object[], aoMudar?: Function}} ctx
 */
export function campoInformativo(def, doc, { cadastros = [], aoMudar } = {}) {
  const mudar = (v) => { doc[def.id] = v; aoMudar?.(def.id, v); };
  const atual = doc[def.id] ?? '';
  let controle;
  switch (def.tipo) {
    case 'fixo':
      controle = h('input', { value: FIXOS_IAT[def.id] ?? atual, readonly: true, tabindex: -1 });
      break;
    case 'auto':
      controle = h('input', { value: numeroFormatado(doc), readonly: true, tabindex: -1 });
      break;
    case 'data':
      controle = h('input', { type: 'date', value: atual, onchange: (e) => mudar(e.target.value) });
      break;
    case 'hora':
      controle = h('input', { type: 'time', value: atual, onchange: (e) => mudar(e.target.value) });
      break;
    case 'numero':
      controle = h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', value: atual ?? '', oninput: (e) => mudar(e.target.value === '' ? null : Number(e.target.value)) });
      break;
    case 'moeda':
      controle = h('input', { type: 'number', min: 0, step: 0.01, inputmode: 'decimal', placeholder: 'R$ 0,00', value: atual ?? '', oninput: (e) => mudar(e.target.value === '' ? null : Number(e.target.value)) });
      break;
    case 'lista':
      controle = h('select', { onchange: (e) => mudar(e.target.value) }, opcoesSelect(def.opcoes, atual));
      break;
    case 'simnao':
      controle = h('select', { onchange: (e) => mudar(e.target.value) }, opcoesSelect(SIM_NAO, atual));
      break;
    case 'obra':
      controle = h('select', { onchange: (e) => mudar(e.target.value) },
        opcoesSelect(cadastros.map((c) => [c.id, c.obra]), atual, 'Selecione a obra'));
      break;
    case 'longo':
      controle = h('textarea', { rows: 6, oninput: (e) => mudar(e.target.value) }, atual);
      break;
    case 'tabela': {
      // Tabela do eSocial: lista suspensa padrão do sistema, com busca pelo código ou por parte da descrição.
      const tabela = TABELAS_IAT[def.tabela];
      controle = buscaLista({
        opcoes: tabela.map(([codigo, descricao]) => ({ valor: codigo, rotulo: `${codigo} – ${descricao}` })),
        valor: descricaoTabela(tabela, atual) ? atual : null,
        rotulo: def.rotulo,
        placeholder: 'Digite o código ou parte da descrição',
        aoMudar: ({ valor }) => mudar(valor ?? ''),
      });
      break;
    }
    default:
      controle = h('input', { value: atual, maxlength: 300, oninput: (e) => mudar(e.target.value) });
  }
  const el = campo(def.obrigatorio ? `${def.rotulo} *` : def.rotulo, controle, def.ajuda ?? null);
  el.classList.add('inf-campo');
  el.style.gridColumn = `span ${def.largura ?? 12}`;
  el.dataset.campo = def.id;
  el.dataset.largura = String(def.largura ?? 12);
  return el;
}

/** Espaço de foto com legenda: escolher, trocar ou remover. A imagem sobe na hora; o id vai para o documento. */
export function espacoFoto({ legenda, id, aoMudar, somenteLeitura = false }) {
  const caixa = h('div', { class: 'inf-foto' });
  const entrada = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'sr-only', tabindex: -1 });
  let atual = id ?? null;
  const desenhar = (enviando = false) => {
    const imagem = atual ? h('img', { src: api.urlArquivo(atual), alt: legenda ?? 'Foto' }) : h('span', { class: 'inf-foto-vazia' }, icone('camera', { tamanho: 28 }), somenteLeitura ? 'Sem foto' : 'Adicionar foto');
    montar(caixa,
      h('div', { class: 'inf-foto-area' }, enviando ? h('span', { class: 'spin' }) : imagem),
      legenda ? h('b', { class: 'inf-foto-legenda' }, legenda) : null,
      somenteLeitura ? null : h('div', { class: 'row inf-foto-acoes' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => entrada.click() }, atual ? 'Trocar' : 'Escolher foto'),
        atual ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { atual = null; aoMudar(null); desenhar(); } }, 'Remover') : null),
      entrada);
  };
  entrada.addEventListener('change', async () => {
    const [arquivo] = entrada.files;
    entrada.value = '';
    if (!arquivo) return;
    desenhar(true);
    try {
      atual = (await api.enviarArquivo(arquivo)).id;
      aoMudar(atual);
    } catch (e) {
      toast('error', 'Não foi possível enviar a foto', e.message);
    }
    desenhar();
  });
  desenhar();
  return caixa;
}

/** Anexo em PDF de uma evidência ("Sim" → anexar a cópia do documento). */
export function anexoPdf({ id, nome, aoMudar }) {
  const caixa = h('div', { class: 'inf-anexo' });
  const entrada = h('input', { type: 'file', accept: 'application/pdf', class: 'sr-only', tabindex: -1 });
  let atual = { id, nome };
  const desenhar = (enviando = false) => montar(caixa,
    enviando ? h('span', { class: 'spin' }) : atual.id
      ? h('a', { href: api.urlArquivo(atual.id), target: '_blank', rel: 'noopener' }, icone('texto', { tamanho: 14 }), atual.nome || 'Documento anexado')
      : h('span', { class: 'muted small' }, 'Nenhum documento anexado'),
    h('button', { class: 'btn ghost sm', type: 'button', onclick: () => entrada.click() }, atual.id ? 'Trocar PDF' : 'Anexar PDF'),
    atual.id ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { atual = {}; aoMudar(null, ''); desenhar(); } }, 'Remover') : null,
    entrada);
  entrada.addEventListener('change', async () => {
    const [arquivo] = entrada.files;
    entrada.value = '';
    if (!arquivo) return;
    desenhar(true);
    try {
      const r = await api.enviarArquivo(arquivo);
      atual = { id: r.id, nome: r.nome };
      aoMudar(r.id, r.nome);
    } catch (e) {
      toast('error', 'Não foi possível anexar o documento', e.message);
    }
    desenhar();
  });
  desenhar();
  return caixa;
}

/** Número do registro (Nº da CAT / Nº da IST): o salvo ou, num registro novo, o previsto (último + 1). */
export const numeroFormatado = (doc) => {
  const n = doc.numero ?? doc.numeroPrevisto;
  return n ? String(n).padStart(2, '0') : '';
};

/** Controle sem rótulo visível, com o mesmo estilo dos campos do sistema (.field). */
export const controleField = (controle) => h('div', { class: 'field' }, controle);

/** Sub-abas (botões). */
export function subAbas(abas, atual, aoEscolher) {
  return h('div', { class: 'seg-botoes inf-abas', role: 'tablist' }, abas.map((a) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(a.id === atual), onclick: () => aoEscolher(a.id),
  }, a.nome)));
}

/** Seção do formulário (título da planilha + grade de 12 colunas). */
export const secao = (titulo, ...conteudo) => h('section', { class: 'card card-pad inf-secao' }, h('h3', { class: 'inf-secao-titulo' }, titulo), ...conteudo);
export const grade = (...campos) => h('div', { class: 'inf-grade' }, ...campos);
