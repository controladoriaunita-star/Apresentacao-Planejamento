/**
 * Administração → Novas telas: o Planejamento cria telas extras das apresentações Obra e/ou Cliente com
 * imagens, planilhas (exibidas somente leitura) e textos, por obra.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { estado } from '../core/estado.js';
import { DESTINOS, TIPOS_BLOCO, destinoDaTela } from '../domain/conteudo.js';
import { abrirModal, alerta, badge, botaoAcao, campo, carregando, confirmar, toast, vazio } from '../ui/componentes.js';
import { ir } from '../core/roteador.js';
import { seletorArquivos } from '../ui/seletor-arquivos.js';
import { seletorDestino } from '../ui/seletor-destino.js';

const ACEITA = {
  imagem: 'image/png,image/jpeg,image/webp,image/gif',
  planilha: '.xlsx,.xlsm,.xls,.csv',
};

export async function renderAdminTelas(alvo) {
  const desenhar = async () => {
    montar(alvo, carregando(4));
    let telas;
    try {
      telas = await api.get('/telas');
    } catch (e) {
      return montar(alvo, alerta('error', 'Erro ao carregar', e.message));
    }
    const base = estado.base('obra');
    const nomeObra = (chave) => base.obras.find((o) => o.chave === chave)?.nome ?? chave;
    montar(alvo,
      h('div', { class: 'titulo-pagina' },
        h('div', {}, h('h1', {}, 'Novas telas'), h('p', {}, 'Telas extras das apresentações Obra e Cliente, com planilhas (somente leitura), imagens e textos.')),
        h('button', { class: 'btn primary', type: 'button', onclick: () => abrirFormTela({}, desenhar) }, 'Nova tela')),
      telas.length
        ? h('div', { class: 'sheet' }, h('table', { class: 'lista-admin' },
          h('thead', {}, h('tr', {}, h('th', { class: 'first' }, 'Tela'), h('th', {}, 'Apresentação'), h('th', {}, 'Obras'), h('th', {}, 'Blocos'), h('th', {}, 'Ordem'), h('th', {}, 'Situação'), h('th', {}))),
          h('tbody', {}, telas.map((t) => h('tr', {},
            h('td', { class: 'first' }, t.titulo),
            h('td', { class: 'esq' }, DESTINOS[destinoDaTela(t)]),
            h('td', { class: 'texto' }, t.obras.length ? t.obras.map(nomeObra).join(', ') : 'Todas'),
            h('td', {}, t.blocos.length),
            h('td', {}, t.ordem),
            h('td', {}, t.ativa ? badge('Ativa', 'success') : badge('Oculta', 'neutral')),
            h('td', { class: 'acoes' },
              h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ir(`/${destinoDaTela(t) === 'obra' ? 'obra' : 'cliente'}/tela/${t.id}`) }, 'Ver'),
              h('button', { class: 'btn ghost sm', type: 'button', onclick: () => abrirFormTela(t, desenhar) }, 'Editar'),
              h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => {
                if (!(await confirmar('Excluir tela?', `"${t.titulo}" e seus arquivos serão apagados.`, { rotulo: 'Excluir', perigo: true }))) return;
                await api.del(`/telas/${t.id}`);
                toast('success', 'Tela excluída');
                desenhar();
              } }, 'Excluir')))))))
        : vazio('Nenhuma tela criada', 'Crie telas para mostrar planilhas e imagens na apresentação ao cliente.'));
  };
  await desenhar();
}

function abrirFormTela(inicial, aoSalvar) {
  const base = estado.base('obra');
  const erro = h('div');
  const titulo = h('input', { value: inicial.titulo ?? '', required: true });
  const subtitulo = h('input', { value: inicial.subtitulo ?? '' });
  const ordem = h('input', { type: 'number', value: inicial.ordem ?? 0 });
  const ativa = h('input', { type: 'checkbox', checked: inicial.ativa !== false });
  const destino = seletorDestino(destinoDaTela(inicial));
  const obrasSel = new Set(inicial.obras ?? []);
  const obras = h('div', { class: 'form-grade' }, base.obras.map((o) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: obrasSel.has(o.chave), onchange: (e) => (e.target.checked ? obrasSel.add(o.chave) : obrasSel.delete(o.chave)) }), o.nome)));

  const blocos = (inicial.blocos ?? []).map((b) => ({ ...b }));
  const listaBlocos = h('div', { class: 'stack' });
  const desenharBlocos = () => montar(listaBlocos, ...blocos.map((b, i) => editorBloco(b, i, blocos, desenharBlocos)));
  desenharBlocos();

  const m = abrirModal({
    titulo: inicial.id ? 'Editar tela' : 'Nova tela',
    largo: true,
    conteudo: h('div', { class: 'stack' },
      erro,
      h('div', { class: 'form-grade' }, campo('Título *', titulo), campo('Subtítulo', subtitulo), destino.elemento, campo('Ordem no menu', ordem)),
      h('label', { class: 'check' }, ativa, 'Tela ativa (aparece na apresentação)'),
      h('div', {}, h('p', { class: 'sub' }, 'Obras (nenhuma marcada = todas)'), obras),
      h('div', {}, h('p', { class: 'sub' }, 'Conteúdo'), listaBlocos,
        h('div', { class: 'row', style: { marginTop: '10px' } }, Object.entries(TIPOS_BLOCO).map(([tipo, nome]) => h('button', {
          class: 'btn secondary sm', type: 'button', onclick: () => { blocos.push({ tipo, largura: 'inteira' }); desenharBlocos(); },
        }, `+ ${nome}`))))),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      botaoAcao('Salvar', async () => {
        montar(erro);
        try {
          const corpo = { titulo: titulo.value, subtitulo: subtitulo.value, destino: destino.valor(), ordem: Number(ordem.value), ativa: ativa.checked, obras: [...obrasSel], blocos };
          if (inicial.id) await api.put(`/telas/${inicial.id}`, corpo);
          else await api.post('/telas', corpo);
          m.fechar();
          toast('success', 'Tela salva');
          aoSalvar();
        } catch (e) {
          montar(erro, alerta('error', 'Não foi possível salvar', e.message));
        }
      }, 'btn primary'),
    ],
  });
}

/** Editor de um bloco: o arquivo é enviado na hora e o bloco guarda o id. */
function editorBloco(b, i, blocos, redesenhar) {
  const estadoArquivo = h('span', { class: 'muted small' }, b.arquivoId ? `Atual: ${b.arquivoNome ?? 'arquivo enviado'}` : 'Nenhum arquivo enviado ainda');
  const enviar = async ([arquivo]) => {
    if (!arquivo) return;
    estadoArquivo.textContent = 'Enviando…';
    try {
      const r = await api.enviarArquivo(arquivo);
      b.arquivoId = r.id;
      b.arquivoNome = r.nome;
      estadoArquivo.textContent = `Enviado: ${r.nome}`;
    } catch (err) {
      estadoArquivo.textContent = err.message;
    }
  };
  const mover = (d) => { const j = i + d; if (j < 0 || j >= blocos.length) return; [blocos[i], blocos[j]] = [blocos[j], blocos[i]]; redesenhar(); };
  return h('div', { class: 'bloco-editor' },
    h('div', { class: 'row' },
      h('b', {}, `${i + 1}. ${TIPOS_BLOCO[b.tipo]}`),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Mover para cima', onclick: () => mover(-1) }, '↑'),
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Mover para baixo', onclick: () => mover(1) }, '↓'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { blocos.splice(i, 1); redesenhar(); } }, 'Remover')),
    h('div', { class: 'form-grade' },
      campo('Título do bloco', h('input', { value: b.titulo ?? '', oninput: (e) => { b.titulo = e.target.value; } })),
      campo('Largura', h('select', { onchange: (e) => { b.largura = e.target.value; } },
        h('option', { value: 'inteira', selected: b.largura !== 'metade' }, 'Largura inteira'),
        h('option', { value: 'metade', selected: b.largura === 'metade' }, 'Meia largura'))),
      b.tipo === 'planilha' ? campo('Aba a exibir', h('input', { value: b.aba ?? '', placeholder: 'Vazio = primeira aba', oninput: (e) => { b.aba = e.target.value; } })) : null),
    b.tipo === 'texto'
      ? campo('Texto', h('textarea', { oninput: (e) => { b.texto = e.target.value; } }, b.texto ?? ''))
      : h('div', { class: 'stack', style: { gap: '6px' } },
        seletorArquivos({
          aceita: ACEITA[b.tipo], aoEscolher: enviar,
          titulo: b.tipo === 'imagem' ? 'Arraste a imagem ou clique para escolher' : 'Arraste a planilha ou clique para escolher',
          dica: b.tipo === 'imagem' ? 'PNG, JPG ou WEBP' : 'XLSX, XLS ou CSV — exibida somente leitura',
        }).elemento,
        estadoArquivo));
}
