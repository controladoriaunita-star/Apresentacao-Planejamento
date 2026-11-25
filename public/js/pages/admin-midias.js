/**
 * Administração → TxC e fotos: cadastro de imagens por obra + mês (várias de uma vez), edição e exclusão.
 * v36.4: filtros por obra e mês e exclusão de várias imagens marcadas.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtMes } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { DESTINOS, TIPOS_MIDIA, destinoDaMidia } from '../domain/conteudo.js';
import { abrirModal, alerta, botaoAcao, campo, carregando, confirmar, toast, vazio } from '../ui/componentes.js';
import { seletorArquivos } from '../ui/seletor-arquivos.js';
import { seletorDestino } from '../ui/seletor-destino.js';

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
    imagens: true, multiplo: !editando,
    titulo: editando ? 'Arraste a nova imagem ou clique para trocar' : 'Arraste as imagens aqui ou clique para escolher',
    dica: editando ? 'Opcional — sem nova imagem, mantém a atual · qualquer formato de imagem' : 'Qualquer formato de imagem (JPG, PNG, HEIC, WEBP, TIFF…) · cada imagem vira um registro com os mesmos dados',
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
  // v36.4: filtros por obra e mês (sobre a lista carregada) e exclusão de várias imagens de uma vez.
  const filtro = { obra: '', mes: '' };
  const desenhar = async () => {
    montar(alvo, carregando(5));
    let lista;
    try {
      lista = await api.get(`/midias?tipo=${tipo}`);
    } catch (e) {
      return montar(alvo, alerta('error', 'Erro ao carregar', e.message));
    }
    const selecionadas = new Set(); // ids marcados (só entre as linhas visíveis)
    const obras = [...new Set(lista.map((m) => m.obra))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const meses = [...new Set(lista.map((m) => m.mes))].sort().reverse();
    if (!obras.includes(filtro.obra)) filtro.obra = '';
    if (!meses.includes(filtro.mes)) filtro.mes = '';
    const visiveis = () => lista.filter((m) => (!filtro.obra || m.obra === filtro.obra) && (!filtro.mes || m.mes === filtro.mes));

    const tabela = h('div');
    const contagem = h('span', { class: 'muted' });
    const selObra = h('select', { onchange: (e) => { filtro.obra = e.target.value; desenharTabela(); } },
      h('option', { value: '' }, 'Todas as obras'), obras.map((o) => h('option', { value: o, selected: o === filtro.obra }, o)));
    const selMes = h('select', { onchange: (e) => { filtro.mes = e.target.value; desenharTabela(); } },
      h('option', { value: '' }, 'Todos os meses'), meses.map((v) => h('option', { value: v, selected: v === filtro.mes }, fmtMes(v))));
    const excluirVarias = h('button', { class: 'btn danger', type: 'button', disabled: true, onclick: async () => {
      const alvos = lista.filter((m) => selecionadas.has(m.id));
      if (!alvos.length) return;
      if (!(await confirmar(`Excluir ${alvos.length} imagem(ns)?`, 'As imagens selecionadas serão apagadas.', { rotulo: 'Excluir', perigo: true }))) return;
      excluirVarias.disabled = true;
      montar(excluirVarias, h('span', { class: 'spin' }), 'Excluindo…');
      let falhas = 0;
      for (const m of alvos) {
        try { await api.del(`/midias/${m.id}`); } catch { falhas += 1; }
      }
      if (falhas) toast('error', `${falhas} de ${alvos.length} imagem(ns) não foram excluídas`, 'Tente de novo.');
      else toast('success', `${alvos.length} imagem(ns) excluída(s)`);
      desenhar();
    } }, 'Excluir selecionadas');

    const atualizarSelecao = () => {
      const n = selecionadas.size;
      excluirVarias.disabled = n === 0;
      montar(excluirVarias, n ? `Excluir selecionadas (${n})` : 'Excluir selecionadas');
    };

    const linha = (m, todas, doFiltro) => h('tr', {},
      h('td', { class: 'first' }, h('label', { class: 'selecao-midia' },
        h('input', { type: 'checkbox', 'aria-label': `Selecionar a imagem de ${m.obra} (${fmtMes(m.mes)})`, checked: selecionadas.has(m.id), onchange: (e) => {
          if (e.target.checked) selecionadas.add(m.id); else selecionadas.delete(m.id);
          todas.checked = doFiltro.every((x) => selecionadas.has(x.id));
          atualizarSelecao();
        } }),
        m.obra)),
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
        } }, 'Excluir')));

    function desenharTabela() {
      const doFiltro = visiveis();
      // Ao trocar o filtro, desmarca o que saiu da tela: nunca se exclui uma imagem que não está visível.
      const ids = new Set(doFiltro.map((m) => m.id));
      for (const id of [...selecionadas]) if (!ids.has(id)) selecionadas.delete(id);
      montar(contagem, doFiltro.length === lista.length ? `${lista.length} imagem(ns)` : `${doFiltro.length} de ${lista.length} imagem(ns)`);
      const todas = h('input', { type: 'checkbox', 'aria-label': 'Selecionar todas as imagens da lista', checked: doFiltro.length > 0 && doFiltro.every((m) => selecionadas.has(m.id)), onchange: (e) => {
        for (const m of doFiltro) { if (e.target.checked) selecionadas.add(m.id); else selecionadas.delete(m.id); }
        desenharTabela();
      } });
      montar(tabela, doFiltro.length
        ? h('div', { class: 'sheet' }, h('table', { class: 'lista-admin' },
          h('thead', {}, h('tr', {}, h('th', { class: 'first' }, h('label', { class: 'selecao-midia' }, todas, 'Obra')), h('th', {}, 'Imagem'), h('th', {}, 'Mês'), h('th', {}, TIPOS_MIDIA[tipo].grupo), h('th', {}, 'Comentário'), h('th', {}, 'Apresentação'), h('th', {}))),
          h('tbody', {}, doFiltro.map((m) => linha(m, todas, doFiltro)))))
        : vazio('Nenhuma imagem com esses filtros', 'Troque a obra ou o mês para ver outras imagens.'));
      atualizarSelecao();
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
        ? [h('div', { class: 'filtros-midia' }, campo('Obra', selObra), campo('Mês', selMes), contagem, excluirVarias), tabela]
        : vazio('Nenhuma imagem cadastrada', 'Cadastre as imagens de TxC ou fotos de cada obra e mês.'));
    if (lista.length) desenharTabela();
  };
  await desenhar();
}

function sessionStorageSeguro(chave) {
  try { return sessionStorage.getItem(chave); } catch { return null; }
}
function guardar(chave, valor) {
  try { sessionStorage.setItem(chave, valor); } catch { /* sem armazenamento */ }
}
