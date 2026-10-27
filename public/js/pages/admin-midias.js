/**
 * Administração → TxC e fotos: cadastro de imagens por obra + mês (várias de uma vez), edição e exclusão.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtMes } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { DESTINOS, TIPOS_MIDIA, destinoDaMidia } from '../domain/conteudo.js';
import { abrirModal, alerta, botaoAcao, campo, carregando, confirmar, toast, vazio } from '../ui/componentes.js';
import { seletorArquivos } from '../ui/seletor-arquivos.js';
import { seletorDestino } from '../ui/seletor-destino.js';

const IMAGENS = 'image/png,image/jpeg,image/webp,image/gif';

/**
 * Formulário de cadastro/edição. Em cadastro novo aceita vários arquivos: cada um vira um registro.
 * @param {object} inicial  {tipo, obra, mes, …} ou a mídia existente (com id)
 */
export function abrirFormMidia(inicial, aoSalvar) {
  const editando = Boolean(inicial.id);
  const base = estado.base('obra');
  const def = TIPOS_MIDIA[inicial.tipo];
  const erro = h('div');
  const obra = h('select', { required: true }, base.obras.map((o) => h('option', { value: o.nome, selected: o.nome === inicial.obra }, o.nome)));
  const mes = h('input', { type: 'month', value: inicial.mes ?? '', required: true });
  const grupo = h('input', { value: inicial.grupo ?? '', placeholder: inicial.tipo === 'txc' ? 'Ex.: Torre A' : 'Ex.: Fachada, Térreo' });
  const comentario = h('textarea', { placeholder: 'Aparece abaixo da imagem na apresentação' }, inicial.comentario ?? '');
  const ordem = h('input', { type: 'number', value: inicial.ordem ?? 0, style: { maxWidth: '120px' } });
  const destino = seletorDestino(destinoDaMidia(inicial));
  const arquivos = seletorArquivos({
    aceita: IMAGENS, multiplo: !editando,
    titulo: editando ? 'Arraste a nova imagem ou clique para trocar' : 'Arraste as imagens aqui ou clique para escolher',
    dica: editando ? 'Opcional — sem nova imagem, mantém a atual' : 'PNG, JPG ou WEBP · cada imagem vira um registro com os mesmos dados',
  });

  const salvar = async () => {
    montar(erro);
    try {
      const comum = { tipo: inicial.tipo, obra: obra.value, mes: mes.value, grupo: grupo.value, comentario: comentario.value, ordem: Number(ordem.value), destino: destino.valor() };
      const selecionados = arquivos.arquivos();
      if (editando) {
        const arquivoId = selecionados[0] ? (await api.enviarArquivo(selecionados[0])).id : inicial.arquivoId;
        await api.put(`/midias/${inicial.id}`, { ...comum, arquivoId });
      } else {
        if (!selecionados.length) throw new Error('Escolha ao menos uma imagem.');
        for (const [i, arquivo] of selecionados.entries()) {
          const { id } = await api.enviarArquivo(arquivo);
          await api.post('/midias', { ...comum, ordem: comum.ordem + i, arquivoId: id });
        }
      }
      m.fechar();
      toast('success', editando ? 'Imagem atualizada' : `${selecionados.length} imagem(ns) cadastrada(s)`);
      aoSalvar?.();
    } catch (e) {
      montar(erro, alerta('error', 'Não foi possível salvar', e.message));
    }
  };

  const m = abrirModal({
    titulo: `${editando ? 'Editar' : 'Cadastrar'} — ${def.nome}`,
    largo: true,
    conteudo: h('div', { class: 'stack' },
      erro,
      h('div', { class: 'form-grade' },
        campo('Obra', obra),
        campo('Mês', mes),
        campo(def.grupo, grupo, inicial.tipo === 'txc' ? 'Separa as imagens por torre na apresentação' : 'Separa as fotos por local'),
        campo('Ordem', ordem),
        destino.elemento),
      campo('Comentário', comentario),
      h('div', { class: 'field' }, h('span', {}, editando ? 'Trocar imagem' : 'Imagens'), arquivos.elemento)),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      botaoAcao('Salvar', salvar, 'btn primary'),
    ],
  });
}

export async function renderAdminMidias(alvo) {
  let tipo = sessionStorageSeguro('admin.midias.tipo') ?? 'txc';
  const desenhar = async () => {
    montar(alvo, carregando(5));
    let lista;
    try {
      lista = await api.get(`/midias?tipo=${tipo}`);
    } catch (e) {
      return montar(alvo, alerta('error', 'Erro ao carregar', e.message));
    }
    montar(alvo,
      h('div', { class: 'titulo-pagina' },
        h('div', {}, h('h1', {}, 'TxC e fotos'), h('p', {}, 'Imagens vinculadas a obra e mês, exibidas nas abas Tempo x Caminho e Acompanhamento Fotográfico.')),
        h('div', { class: 'row' },
          h('div', { class: 'segmentos', role: 'group' }, Object.entries(TIPOS_MIDIA).map(([t, d]) => h('button', {
            type: 'button', 'aria-pressed': String(t === tipo), onclick: () => { tipo = t; guardar('admin.midias.tipo', t); desenhar(); },
          }, d.nome))),
          h('button', { class: 'btn primary', type: 'button', onclick: () => abrirFormMidia({ tipo, mes: estado.filtro.referencia, obra: estado.base('obra').obras.find((o) => o.chave === estado.filtro.obras[0])?.nome }, desenhar) }, 'Cadastrar imagens'))),
      lista.length
        ? h('div', { class: 'sheet' }, h('table', { class: 'lista-admin' },
          h('thead', {}, h('tr', {}, h('th', { class: 'first' }, 'Obra'), h('th', {}, 'Imagem'), h('th', {}, 'Mês'), h('th', {}, TIPOS_MIDIA[tipo].grupo), h('th', {}, 'Comentário'), h('th', {}, 'Apresentação'), h('th', {}))),
          h('tbody', {}, lista.map((m) => h('tr', {},
            h('td', { class: 'first' }, m.obra),
            h('td', {}, h('img', { class: 'miniatura-admin', src: api.urlArquivo(m.arquivoId), alt: '', loading: 'lazy' })),
            h('td', {}, fmtMes(m.mes)),
            h('td', { class: 'esq' }, m.grupo ?? '—'),
            h('td', { class: 'texto' }, m.comentario ?? '—'),
            h('td', { class: 'esq' }, DESTINOS[destinoDaMidia(m)]),
            h('td', { class: 'acoes' },
              h('button', { class: 'btn ghost sm', type: 'button', onclick: () => abrirFormMidia(m, desenhar) }, 'Editar'),
              h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => {
                if (!(await confirmar('Excluir imagem?', `A imagem de ${m.obra} (${fmtMes(m.mes)}) será apagada.`, { rotulo: 'Excluir', perigo: true }))) return;
                await api.del(`/midias/${m.id}`);
                toast('success', 'Imagem excluída');
                desenhar();
              } }, 'Excluir')))))))
        : vazio('Nenhuma imagem cadastrada', 'Cadastre as imagens de TxC ou fotos de cada obra e mês.'));
  };
  await desenhar();
}

function sessionStorageSeguro(chave) {
  try { return sessionStorage.getItem(chave); } catch { return null; }
}
function guardar(chave, valor) {
  try { sessionStorage.setItem(chave, valor); } catch { /* sem armazenamento */ }
}
