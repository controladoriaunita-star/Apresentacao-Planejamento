/**
 * Área de envio de arquivos (arrastar e soltar ou clicar), no lugar do <input type="file"> nativo.
 * Mostra miniatura das imagens e permite remover antes de salvar.
 *
 *   const sel = seletorArquivos({ imagens: true, multiplo: true });
 *   `imagens: true` aceita imagem em qualquer formato (ui/imagem.js): o que não for PNG/JPG/WEBP/GIF é
 *   convertido ao escolher, e o que não for imagem é recusado (inclusive ao arrastar).
 *   sel.elemento   → para inserir no formulário
 *   sel.arquivos() → File[] escolhidos
 */
import { h, montar } from '../core/dom.js';
import { toast } from './componentes.js';
import { ACEITA_IMAGENS, prepararImagem } from './imagem.js';
import { icone } from './icones.js';

const tamanho = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function seletorArquivos({ aceita = '', imagens = false, multiplo = false, titulo = null, dica = null, aoEscolher = null } = {}) {
  let escolhidos = [];
  const entrada = h('input', { type: 'file', accept: imagens ? ACEITA_IMAGENS : aceita, multiple: multiplo, class: 'sr-only', tabindex: -1 });
  const lista = h('ul', { class: 'arquivos-escolhidos' });
  const textoPrincipal = titulo ?? (multiplo ? 'Arraste os arquivos aqui ou clique para escolher' : 'Arraste o arquivo aqui ou clique para escolher');

  const zona = h('div', { class: 'zona-envio', role: 'button', tabindex: 0, 'aria-label': textoPrincipal },
    h('span', { class: 'zona-icone' }, icone('enviar', { tamanho: 22 })),
    h('span', { class: 'zona-texto' }, h('b', {}, textoPrincipal), dica ? h('small', {}, dica) : null));

  const definir = async (recebidos) => {
    let novos = multiplo ? recebidos : recebidos.slice(0, 1);
    if (imagens) novos = await converter(novos);
    if (!novos.length) return;
    escolhidos = multiplo ? [...escolhidos, ...novos] : novos;
    desenhar();
    aoEscolher?.(escolhidos);
  };

  const desenhar = () => {
    montar(lista, escolhidos.map((arquivo, i) => {
      const ehImagem = arquivo.type.startsWith('image/');
      const url = ehImagem ? URL.createObjectURL(arquivo) : null;
      return h('li', {},
        ehImagem ? h('img', { src: url, alt: '', onload: () => URL.revokeObjectURL(url) }) : h('span', { class: 'arquivo-icone' }, icone(/sheet|excel|csv/.test(arquivo.type) || /\.(xlsx?|xlsm|csv)$/i.test(arquivo.name) ? 'planilha' : 'texto')),
        h('span', { class: 'arquivo-nome' }, h('b', {}, arquivo.name), h('small', {}, tamanho(arquivo.size))),
        h('button', { class: 'btn-icone', type: 'button', 'aria-label': `Remover ${arquivo.name}`, onclick: () => { escolhidos.splice(i, 1); desenhar(); aoEscolher?.(escolhidos); } }, icone('x', { tamanho: 16 })));
    }));
    lista.classList.toggle('oculto', escolhidos.length === 0);
  };

  /** Converte para PNG/JPG o que precisar; avisa e descarta o que não for imagem ou não abrir. */
  const converter = async (arquivos) => {
    zona.classList.add('convertendo');
    try {
      const resultados = await Promise.allSettled(arquivos.map(prepararImagem));
      for (const r of resultados) if (r.status === 'rejected') toast('warning', 'Arquivo não aceito', r.reason.message);
      return resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    } finally {
      zona.classList.remove('convertendo');
    }
  };

  zona.addEventListener('click', () => entrada.click());
  zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.click(); } });
  entrada.addEventListener('change', () => { definir([...entrada.files]); entrada.value = ''; });
  for (const evento of ['dragenter', 'dragover']) zona.addEventListener(evento, (e) => { e.preventDefault(); zona.classList.add('arrastando'); });
  for (const evento of ['dragleave', 'drop']) zona.addEventListener(evento, () => zona.classList.remove('arrastando'));
  zona.addEventListener('drop', (e) => { e.preventDefault(); definir([...e.dataTransfer.files]); });

  desenhar();
  return { elemento: h('div', { class: 'seletor-arquivos' }, zona, entrada, lista), arquivos: () => [...escolhidos] };
}
