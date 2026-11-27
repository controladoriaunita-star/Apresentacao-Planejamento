/**
 * Administração → Segurança do Trabalho: cadastro manual de acidentes, importação da planilha acumulativa
 * (com pré-visualização e de-para de obras), download do modelo oficial e tabela histórica com filtros,
 * pesquisa, ordenação por data e paginação feitas no servidor.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtData, fmtDataHora, fmtNumero, VAZIO } from '../core/formato.js';
import { estado } from '../core/estado.js';
import {
  CABECALHOS_MODELO, CATEGORIAS_QUASE, dadosDaObra, ehPlanilhaQuase, FASES_OBRA, PARTES_CORPO, pendenciasDaObra, SIGLA_QUASE, TIPOS_ACIDENTE,
  TIPOS_REGISTRO, validarAcidente,
} from '../domain/seguranca.js';
import { pode } from '../domain/permissoes.js';
import { buscaObra } from '../ui/busca-obra.js';
import { abrirModal, alerta, badge, botaoAcao, campo, carregando, confirmar, toast, vazio } from '../ui/componentes.js';
import { abrirEmailsDasObras } from '../ui/emails-obra.js';
import { filtroExcel } from '../ui/filtro-excel.js';
import { icone } from '../ui/icones.js';
import { baixarPlanilha, linhasComoObjetos } from '../ui/planilha.js';
import { seletorArquivos } from '../ui/seletor-arquivos.js';

const NOME_TIPO = Object.fromEntries(TIPOS_REGISTRO.map((t) => [t.sigla, t.nome]));
const COR_TIPO = { CPT: 'info', SPT: 'success', TRJ: 'primary', FT: 'error', QA: 'qa' };
const ehQuase = (a) => a.tipo === SIGLA_QUASE;

/** Sub-aba da tela: ocorrências (histórico), IAT ou IST — lembrada enquanto o app estiver aberto. */
let abaAtual = 'ocorrencias';

/** Filtros da tabela histórica (lembrados enquanto a aba estiver aberta). */
const filtro = { obras: null, de: '', ate: '', tipos: [], nome: '', empresa: '', ordem: 'desc', pagina: 1 };

const cadastrosDaObra = () => estado.cadastros().filter((c) => c.id).sort((a, b) => a.obra.localeCompare(b.obra, 'pt-BR'));
export const seloTipo = (sigla) => h('span', { class: `badge b-${COR_TIPO[sigla] ?? 'neutral'}`, title: NOME_TIPO[sigla] ?? '' }, sigla);

export async function renderAdminSeguranca(alvo) {
  const cadastros = cadastrosDaObra();
  const incompletos = cadastros.filter((c) => pendenciasDaObra(c).length);
  const resultado = h('div', { class: 'seg-historico' });

  // Depois de salvar os e-mails de uma obra: recarrega as obras (papel Segurança só tem o resumo de /seguranca/obras).
  const recarregarObras = () => (pode(estado.usuario?.papel, 'ver') ? estado.carregarDados() : estado.carregarObrasSeguranca());
  const recarregar = () => (abaAtual === 'ocorrencias' ? carregarTabela(resultado, cadastros, recarregar) : carregarInformativos(resultado, abaAtual));
  const abas = h('div');
  const desenharAbas = () => montar(abas, h('div', { class: 'seg-botoes', role: 'tablist', 'aria-label': 'Registros' },
    [['ocorrencias', 'Ocorrências'], ['iat', 'IAT'], ['ist', 'IST']].map(([id, nome]) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(abaAtual === id), onclick: () => { abaAtual = id; desenharAbas(); recarregar(); },
    }, nome))));
  desenharAbas();
  montar(alvo,
    h('div', { class: 'titulo-pagina' },
      h('div', {}, h('h1', {}, 'Segurança do Trabalho'),
        h('p', {}, 'Ocorrências (acidentes e quase acidentes), IAT e IST por obra: cadastro, importação das planilhas e histórico. Alimenta o Dashboard Segurança e a aba Segurança do Trabalho.')),
      h('div', { class: 'row' },
        h('a', { class: 'btn secondary', href: '#/admin/seguranca-dashboard' }, icone('escudo', { tamanho: 16 }), 'Dashboard Segurança'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => baixarModelo(cadastros) }, icone('planilha', { tamanho: 16 }), 'Baixar modelo'),
        h('button', { class: 'btn secondary', type: 'button', onclick: () => abrirImportacao(cadastros, recarregar) }, icone('enviar', { tamanho: 16 }), 'Importar planilha'),
        h('button', { class: 'btn secondary', type: 'button', onclick: () => abrirImportacao(cadastros, recarregar, { quase: true }) }, icone('enviar', { tamanho: 16 }), 'Importar quase acidentes'),
        h('a', { class: 'btn secondary', href: '#/admin/seguranca-iat/nova' }, 'Nova IAT'),
        h('a', { class: 'btn secondary', href: '#/admin/seguranca-ist/nova' }, 'Nova IST'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => abrirEmailsDasObras(cadastros, recarregarObras) }, 'E-mails das obras'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => abrirFormAcidente({}, cadastros, recarregar) }, 'Nova Ocorrência'))),
    cadastros.length ? null : alerta('warning', 'Nenhuma obra no Cadastro de obras', 'Cadastre as obras em Administração → Cadastro de obras antes de registrar acidentes.'),
    incompletos.length ? alerta('info', `${incompletos.length} obra(s) sem Cliente ou Sistema estrutural no Cadastro de obras`,
      `Elas não recebem acidentes até o cadastro ser completado: ${incompletos.slice(0, 6).map((c) => c.obra).join(', ')}${incompletos.length > 6 ? '…' : ''}.`) : null,
    abas,
    resultado);
  await recarregar();
}

// ── IAT e IST salvas ─────────────────────────────────────────────────────
async function carregarInformativos(alvo, tipo) {
  const nome = tipo.toUpperCase();
  montar(alvo, carregando(4));
  let lista;
  try {
    lista = await api.get(`/seguranca/${tipo}`);
  } catch (e) {
    return montar(alvo, alerta('error', `Não foi possível carregar as ${nome}`, e.message));
  }
  if (!lista.length) {
    return montar(alvo, vazio(`Nenhuma ${nome} registrada`, `Use o botão "Nova ${nome}" para preencher o primeiro informativo.`,
      h('a', { class: 'btn primary', href: `#/admin/seguranca-${tipo}/nova` }, `Nova ${nome}`)));
  }
  const excluirDoc = async (d) => {
    if (!(await confirmar(`Excluir a ${nome} nº ${String(d.numero).padStart(2, '0')}?`, 'O informativo, as fotos e os anexos serão apagados.', { rotulo: 'Excluir', perigo: true }))) return;
    try {
      await api.del(`/seguranca/${tipo}/${d.id}`);
      toast('success', `${nome} excluída`);
      carregarInformativos(alvo, tipo);
    } catch (e) {
      toast('error', 'Não foi possível excluir', e.message);
    }
  };
  montar(alvo, h('div', { class: 'sheet seg-tabela' }, h('table', { class: 'lista-admin' },
    h('thead', {}, h('tr', {}, ['Nº', 'Data', 'Obra', tipo === 'iat' ? 'Acidentado' : 'Classificação', 'Atualizado'].map((t) => h('th', {}, t)), h('th', {}))),
    h('tbody', {}, lista.map((d) => h('tr', {},
      h('td', {}, String(d.numero).padStart(2, '0')),
      h('td', { class: 'esq' }, d.data ? fmtData(d.data) : VAZIO),
      h('td', { class: 'esq' }, d.obra ?? VAZIO),
      h('td', { class: 'esq' }, d.titulo ?? VAZIO),
      h('td', { class: 'esq' }, `${fmtDataHora(d.atualizadoEm)}${d.atualizadoPor ? ` · ${d.atualizadoPor}` : ''}`),
      h('td', { class: 'acoes' },
        h('a', { class: 'btn ghost sm', href: `#/admin/seguranca-${tipo}/${d.id}` }, 'Abrir'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => excluirDoc(d) }, 'Excluir'))))))));
}

// ── Tabela histórica ─────────────────────────────────────────────────────
async function carregarTabela(alvo, cadastros, recarregar) {
  const barra = barraFiltrosHistorico(cadastros, () => { filtro.pagina = 1; recarregar(); });
  const corpo = h('div', {}, carregando(6));
  montar(alvo, barra, corpo);
  const q = new URLSearchParams({ pagina: String(filtro.pagina), tamanho: '50', ordem: filtro.ordem });
  if (filtro.obras) q.set('obras', filtro.obras.join(','));
  if (filtro.de) q.set('de', filtro.de);
  if (filtro.ate) q.set('ate', filtro.ate);
  if (filtro.tipos.length) q.set('tipos', filtro.tipos.join(','));
  if (filtro.nome) q.set('nome', filtro.nome);
  if (filtro.empresa) q.set('empresa', filtro.empresa);
  let r;
  try {
    r = await api.get(`/seguranca/acidentes?${q}`);
  } catch (e) {
    return montar(corpo, alerta('error', 'Não foi possível carregar os acidentes', e.message));
  }
  if (!r.total) {
    const filtrando = filtro.obras || filtro.de || filtro.ate || filtro.tipos.length || filtro.nome || filtro.empresa;
    return montar(corpo, vazio(filtrando ? 'Nenhum acidente com esses filtros' : 'Nenhum acidente registrado',
      filtrando ? 'Ajuste ou limpe os filtros.' : 'Cadastre um acidente ou importe a planilha de controle.'));
  }
  const paginas = Math.ceil(r.total / r.tamanho);
  const ordenar = () => { filtro.ordem = filtro.ordem === 'desc' ? 'asc' : 'desc'; filtro.pagina = 1; recarregar(); };
  const cab = (texto, extra = {}) => h('th', extra, texto);
  montar(corpo,
    h('div', { class: 'sheet seg-tabela' }, h('table', { class: 'lista-admin' },
      h('thead', {}, h('tr', {},
        h('th', { class: 'seg-col-data' }, h('button', { class: 'seg-ordenar', type: 'button', onclick: ordenar, 'aria-label': 'Ordenar por data' },
          'Data', h('span', { 'aria-hidden': 'true' }, filtro.ordem === 'desc' ? '↓' : '↑'))),
        cab('Obra'), cab('Incorporador'), cab('Método construtivo'), cab('Fase da obra'), cab('Nome do acidentado'), cab('Função'),
        cab('Nome da empresa'), cab('Tipo'), cab('Categoria (quase acidente)'), cab('Parte do corpo'), cab('Dias de afastamento'), cab('Resumo do acidente'), h('th', {}))),
      h('tbody', {}, r.itens.map((a) => h('tr', {},
        h('td', { class: 'esq seg-col-data' }, fmtData(a.data)),
        h('td', { class: 'esq' }, a.obra ?? VAZIO),
        h('td', { class: 'esq' }, a.incorporador ?? VAZIO),
        h('td', { class: 'esq' }, a.metodoConstrutivo ?? VAZIO),
        h('td', { class: 'esq' }, a.faseObra ?? VAZIO),
        h('td', { class: 'esq' }, a.nomeAcidentado || VAZIO),
        h('td', { class: 'esq' }, a.funcao || VAZIO),
        h('td', { class: 'esq' }, a.empresa || VAZIO),
        h('td', { class: 'esq' }, seloTipo(a.tipo)),
        h('td', { class: 'esq' }, a.categoria ?? VAZIO),
        h('td', { class: 'esq' }, a.parteCorpo ?? VAZIO),
        h('td', {}, fmtNumero(a.diasAfastamento)),
        h('td', { class: 'texto' }, h('span', { class: 'seg-resumo', title: a.resumo }, a.resumo)),
        h('td', { class: 'acoes' },
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => abrirDetalhes(a, cadastros, recarregar) }, 'Detalhes'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => abrirFormAcidente(a, cadastros, recarregar) }, 'Editar'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => excluir(a, recarregar) }, 'Excluir'))))))),
    h('div', { class: 'seg-paginacao' },
      h('span', { class: 'muted small' }, `${(r.pagina - 1) * r.tamanho + 1}–${Math.min(r.total, r.pagina * r.tamanho)} de ${r.total} acidente(s)`),
      paginas > 1 ? h('div', { class: 'row' },
        h('button', { class: 'btn secondary sm', type: 'button', disabled: r.pagina <= 1, onclick: () => { filtro.pagina -= 1; recarregar(); } }, 'Anterior'),
        h('span', { class: 'small' }, `Página ${r.pagina} de ${paginas}`),
        h('button', { class: 'btn secondary sm', type: 'button', disabled: r.pagina >= paginas, onclick: () => { filtro.pagina += 1; recarregar(); } }, 'Próxima')) : null));
}

function barraFiltrosHistorico(cadastros, aplicar) {
  const itensObras = cadastros.map((c) => ({ valor: c.id, rotulo: c.obra, grupo: c.cliente ?? 'Sem cliente' }));
  const data = (rotulo, chave) => h('label', { class: 'field seg-filtro-data' }, h('span', {}, rotulo),
    h('input', { type: 'date', value: filtro[chave], onchange: (e) => { filtro[chave] = e.target.value; aplicar(); } }));
  let espera;
  const busca = (rotulo, chave, dica) => h('label', { class: 'field seg-filtro-busca' }, h('span', {}, rotulo),
    h('input', { type: 'search', value: filtro[chave], placeholder: dica, oninput: (e) => { clearTimeout(espera); espera = setTimeout(() => { filtro[chave] = e.target.value.trim(); aplicar(); }, 400); } }));
  const limpar = () => { Object.assign(filtro, { obras: null, de: '', ate: '', tipos: [], nome: '', empresa: '' }); aplicar(); };
  return h('div', { class: 'seg-filtros card', role: 'search' },
    filtroExcel({
      rotulo: 'Obras', itens: itensObras, selecionados: filtro.obras ?? itensObras.map((i) => i.valor), multiplo: true, largura: 340,
      aoAplicar: (v) => { filtro.obras = v.length === itensObras.length ? null : v; aplicar(); },
    }),
    data('De', 'de'),
    data('Até', 'ate'),
    filtroExcel({
      rotulo: 'Tipo do acidente', itens: TIPOS_REGISTRO.map((t) => ({ valor: t.sigla, rotulo: `${t.sigla} – ${t.nome}` })),
      selecionados: filtro.tipos.length ? filtro.tipos : TIPOS_REGISTRO.map((t) => t.sigla), multiplo: true, largura: 320,
      aoAplicar: (v) => { filtro.tipos = v.length === TIPOS_REGISTRO.length ? [] : v; aplicar(); },
    }),
    busca('Acidentado', 'nome', 'Pesquisar nome…'),
    busca('Empresa', 'empresa', 'Pesquisar empresa…'),
    h('button', { class: 'btn ghost sm', type: 'button', onclick: limpar }, 'Limpar filtros'));
}

async function excluir(a, recarregar) {
  const pergunta = ehQuase(a) ? ['Excluir quase acidente?', `O quase acidente de ${fmtData(a.data)} (${a.obra}) será apagado e sai dos indicadores.`]
    : ['Excluir acidente?', `O acidente de ${a.nomeAcidentado} em ${fmtData(a.data)} (${a.obra}) será apagado e sai dos indicadores.`];
  if (!(await confirmar(pergunta[0], pergunta[1], { rotulo: 'Excluir', perigo: true }))) return;
  try {
    await api.del(`/seguranca/acidentes/${a.id}`);
    toast('success', 'Acidente excluído');
    recarregar();
  } catch (e) {
    toast('error', 'Não foi possível excluir', e.message);
  }
}

function abrirDetalhes(a, cadastros, recarregar) {
  const item = (rotulo, valor) => h('div', {}, h('dt', {}, rotulo), h('dd', {}, valor ?? VAZIO));
  const m = abrirModal({
    titulo: ehQuase(a) ? `Quase acidente — ${a.obra}` : `Acidente — ${a.nomeAcidentado}`,
    largo: true,
    conteudo: h('div', { class: 'stack' },
      h('dl', { class: 'detalhe-valores seg-detalhe' },
        item('Data', fmtData(a.data)), item('Obra', a.obra), item('Incorporador', a.incorporador), item('Método construtivo', a.metodoConstrutivo),
        item('Fase da obra', a.faseObra), item('Função', a.funcao), item('Nome da empresa', a.empresa), item('Tipo do acidente', `${a.tipo} – ${NOME_TIPO[a.tipo]}`),
        ehQuase(a) ? item('Categoria', a.categoria) : item('Parte do corpo atingida', a.parteCorpo), ehQuase(a) ? null : item('Dias de afastamento', fmtNumero(a.diasAfastamento)),
        item('Origem', a.origem === 'importacao' ? 'Importação de planilha' : 'Cadastro manual'), item('Registrado', `${fmtDataHora(a.criadoEm)}${a.criadoPor ? ` · ${a.criadoPor}` : ''}`)),
      h('div', { class: 'comentario-caixa' }, h('b', {}, ehQuase(a) ? 'Descrição do quase acidente' : 'Resumo do acidente'), h('p', {}, a.resumo)),
      a.atualizadoEm ? h('p', { class: 'muted small' }, `Última alteração em ${fmtDataHora(a.atualizadoEm)}${a.atualizadoPor ? ` por ${a.atualizadoPor}` : ''}.`) : null),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Fechar'),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => { m.fechar(); abrirFormAcidente(a, cadastros, recarregar); } }, 'Editar'),
    ],
  });
}

// ── Formulário (novo / editar) ───────────────────────────────────────────
export function abrirFormAcidente(inicial, cadastros, aoSalvar) {
  const editando = Boolean(inicial.id);
  const erro = h('div');
  const disponiveis = cadastros.filter((c) => !pendenciasDaObra(c).length || c.id === inicial.obraId);
  const obra = h('select', { required: true },
    h('option', { value: '', disabled: true, selected: !inicial.obraId }, inicial.obraPlanilha ? `${inicial.obraPlanilha} (nome da planilha)` : 'Selecione a obra'),
    cadastros.map((c) => {
      const faltam = pendenciasDaObra(c);
      return h('option', { value: c.id, selected: c.id === inicial.obraId, disabled: faltam.length > 0 && c.id !== inicial.obraId }, faltam.length ? `${c.obra} (complete: ${faltam.join(', ')})` : c.obra);
    }));
  const incorporador = h('input', { readonly: true, tabindex: -1, placeholder: 'Preenchido pela obra' });
  const metodo = h('input', { readonly: true, tabindex: -1, placeholder: 'Preenchido pela obra' });
  const preencherObra = () => {
    const d = dadosDaObra(cadastros.find((c) => c.id === obra.value));
    incorporador.value = d.incorporador ?? '';
    metodo.value = d.metodoConstrutivo ?? '';
  };
  obra.addEventListener('change', preencherObra);
  preencherObra();

  const opcoes = (lista, atual, vazioTexto) => [h('option', { value: '', disabled: true, selected: !atual }, vazioTexto), ...lista.map(([v, t]) => h('option', { value: v, selected: v === atual }, t))];
  const hoje = new Date().toISOString().slice(0, 10);
  const data = h('input', { type: 'date', value: inicial.data ?? '', max: hoje, required: true });
  const fase = h('select', { required: true }, opcoes(FASES_OBRA.map((f) => [f, f]), inicial.faseObra, 'Selecione a fase'));
  const nome = h('input', { value: inicial.nomeAcidentado ?? '', required: true, maxlength: 160, autocomplete: 'off' });
  const tipo = h('select', { required: true }, opcoes(TIPOS_REGISTRO.map((t) => [t.sigla, `${t.sigla} – ${t.nome}`]), inicial.tipo, 'Selecione o tipo'));
  const categoria = h('select', {}, opcoes(CATEGORIAS_QUASE.map((c) => [c, c]), inicial.categoria, 'Selecione a categoria'));
  const funcao = h('input', { value: inicial.funcao ?? '', required: true, maxlength: 120 });
  const parte = h('select', { required: true }, opcoes(PARTES_CORPO.map((p) => [p, p]), inicial.parteCorpo, 'Selecione a parte do corpo'));
  const empresa = h('input', { value: inicial.empresa ?? '', required: true, maxlength: 160 });
  const dias = h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', value: inicial.diasAfastamento ?? '', required: true });
  const resumo = h('textarea', { required: true, rows: 6, placeholder: 'Descreva as circunstâncias: atividade, local, o que aconteceu e a consequência.' }, inicial.resumo ?? '');
  // Opções vazias ficam desabilitadas: servem só de "Selecione…"; nenhuma opção vazia pode ser escolhida.

  const salvar = async () => {
    montar(erro);
    const corpo = {
      data: data.value, obraId: obra.value, faseObra: fase.value, nomeAcidentado: nome.value, tipo: tipo.value, funcao: funcao.value,
      parteCorpo: parte.value, empresa: tipo.value === SIGLA_QUASE ? null : empresa.value, diasAfastamento: dias.value === '' ? null : Number(dias.value), resumo: resumo.value,
      categoria: tipo.value === SIGLA_QUASE ? categoria.value : null,
      obraPlanilha: inicial.obraPlanilha ?? null,
    };
    const { erros } = validarAcidente(corpo);
    if (erros.length) return montar(erro, alerta('error', 'Revise os campos obrigatórios', h('ul', { class: 'seg-erros' }, erros.map((e) => h('li', {}, e)))));
    try {
      if (editando) await api.put(`/seguranca/acidentes/${inicial.id}`, corpo);
      else await api.post('/seguranca/acidentes', corpo);
      m.fechar();
      const nomeRegistro = tipo.value === SIGLA_QUASE ? 'Quase acidente' : 'Acidente';
      toast('success', `${nomeRegistro} ${editando ? 'atualizado' : 'registrado'}`, 'Os indicadores já consideram este registro.');
      aoSalvar?.();
    } catch (e) {
      montar(erro, alerta('error', 'Não foi possível salvar', e.message));
    }
  };

  const obrig = (rotulo) => `${rotulo} *`;
  const campoFase = campo(obrig('Fase da obra'), fase);
  const campoNome = campo(obrig('Nome do acidentado'), nome);
  const campoFuncao = campo(obrig('Função'), funcao);
  const campoEmpresa = campo(obrig('Nome da empresa'), empresa);
  const campoParte = campo(obrig('Parte do corpo atingida'), parte);
  const campoDias = campo(obrig('Nº de dias de afastamento'), dias, 'Inteiro, 0 ou mais');
  const campoResumo = campo(obrig('Resumo do acidente'), resumo);
  const caixaCategoria = h('div', { class: 'seg-categoria-quase' }, campo(obrig('Categoria padronizada'), categoria, 'Mesmas categorias da planilha de quase acidentes'));
  const rotular = (c, texto) => { c.firstChild.textContent = texto; };

  /** Tipo "Quase acidente": abre a caixa de categorias e tira o que só existe em acidente com pessoa. */
  const aplicarTipo = () => {
    const quase = tipo.value === SIGLA_QUASE;
    caixaCategoria.hidden = !quase;
    for (const c of [campoNome, campoFuncao, campoEmpresa, campoParte, campoDias]) c.style.display = quase ? 'none' : '';
    rotular(campoFase, quase ? 'Fase da obra' : obrig('Fase da obra'));
    fase.options[0].disabled = !quase; // em quase acidente a fase pode ficar em branco
    rotular(campoResumo, obrig(quase ? 'Descrição do quase acidente' : 'Resumo do acidente'));
    resumo.placeholder = quase ? 'Descreva a condição ou o desvio encontrado.' : 'Descreva as circunstâncias: atividade, local, o que aconteceu e a consequência.';
    data.max = quase ? `${hoje.slice(0, 7)}-${String(new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}` : hoje;
  };
  tipo.addEventListener('change', aplicarTipo);
  aplicarTipo();

  const m = abrirModal({
    titulo: editando ? (ehQuase(inicial) ? 'Editar quase acidente' : 'Editar acidente') : 'Nova ocorrência',
    largo: true,
    conteudo: h('div', { class: 'stack' },
      erro,
      disponiveis.length ? null : alerta('warning', 'Nenhuma obra apta', 'Complete Cliente e Sistema estrutural em Administração → Cadastro de obras.'),
      h('div', { class: 'form-grupo' }, h('p', { class: 'sub' }, 'Obra'),
        h('div', { class: 'form-grade' },
          campo(obrig('Data'), data),
          campo(obrig('Obra'), obra, 'Obras do Cadastro de obras'),
          campo('Incorporador', incorporador, 'Cliente do Cadastro de obras'),
          campo('Método construtivo', metodo, 'Sistema estrutural do Cadastro de obras'),
          campoFase)),
      h('div', { class: 'form-grupo' }, h('p', { class: 'sub' }, 'Acidentado e ocorrência'),
        h('div', { class: 'form-grade' },
          campo(obrig('Tipo do acidente'), tipo),
          campoNome,
          campoFuncao,
          campoEmpresa,
          campoParte,
          campoDias),
        caixaCategoria),
      campoResumo),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      botaoAcao('Salvar', salvar, 'btn primary'),
    ],
  });
}

// ── Modelo e importação ──────────────────────────────────────────────────
async function baixarModelo(cadastros) {
  try {
    const exemploVazio = CABECALHOS_MODELO.map(() => null);
    await baixarPlanilha('Modelo - Controle de Acidentes.xlsx', [
      { nome: 'Dados', linhas: [CABECALHOS_MODELO, exemploVazio], larguras: [14, 8, 8, 30, 20, 22, 18, 30, 20, 24, 8, 22, 14, 70] },
      {
        nome: 'Listas',
        linhas: listasDoModelo(cadastros),
        larguras: [30, 22, 22, 8, 36, 22, 22],
      },
      { nome: 'Instruções', linhas: INSTRUCOES.map((t) => [t]), larguras: [120] },
    ]);
  } catch (e) {
    toast('error', 'Não foi possível gerar o modelo', e.message);
  }
}

const INSTRUCOES = [
  'Modelo oficial — Controle de Acidentes (Segurança do Trabalho)',
  '',
  '1. Preencha uma linha por acidente na aba "Dados", a partir da linha 2. Não altere os cabeçalhos.',
  '2. Todos os campos são obrigatórios, exceto "Mês" e "Ano" (calculados pelo sistema a partir da data) e "Incorporação" / "Método Construtivo" (vêm do Cadastro de obras).',
  '3. Nome da Obra: igual ao Cadastro de obras do sistema (aba "Listas"). Nomes diferentes podem ser associados na pré-visualização da importação.',
  '4. Tipo: CPT, SPT, TRJ ou FT. Parte do Corpo Atingida e Fase da Obra: somente os valores da aba "Listas".',
  '5. Dias Afastamento: número inteiro, 0 ou mais. Data do Acidente: dd/mm/aaaa, não pode ser futura.',
  '6. A planilha pode ser acumulativa: acidentes já importados são reconhecidos e não entram de novo.',
  '   Mesmo acidente = mesma data, obra, acidentado, tipo, parte do corpo, função e empresa.',
];

function listasDoModelo(cadastros) {
  const colunas = [
    ['Nome da Obra', ...cadastros.map((c) => c.obra)],
    ['Incorporação', ...cadastros.map((c) => c.cliente ?? '')],
    ['Método Construtivo', ...cadastros.map((c) => c.sistemaEstrutural ?? '')],
    ['Tipo', ...TIPOS_ACIDENTE.map((t) => t.sigla)],
    ['Descrição do tipo', ...TIPOS_ACIDENTE.map((t) => t.nome)],
    ['Parte do Corpo Atingida', ...PARTES_CORPO],
    ['Fase da Obra', ...FASES_OBRA],
  ];
  const altura = Math.max(...colunas.map((c) => c.length));
  return Array.from({ length: altura }, (_, i) => colunas.map((c) => c[i] ?? null));
}

/** Datas do SheetJS (cellDates) → AAAA-MM-DD no fuso local, sem o deslocamento de horas do Excel. */
function serializarLinha(linha) {
  const saida = { __linha: (linha.__rowNum__ ?? 0) + 1 };
  for (const [k, v] of Object.entries(linha)) {
    if (v instanceof Date) {
      const d = new Date(v.getTime() + 12 * 3600 * 1000);
      saida[k] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else saida[k] = v;
  }
  return saida;
}

function abrirImportacao(cadastros, aoImportar, { quase = false } = {}) {
  const modo = quase ? 'quase' : 'acidentes';
  const nomeRegistros = quase ? 'quase acidente(s)' : 'acidente(s)';
  const sel = seletorArquivos(quase
    ? { aceita: '.xlsx,.xlsm,.xls', titulo: 'Arraste a planilha de quase acidentes ou clique para escolher', dica: 'Aba "Base Consolidada": Obra, Mês, Descrição do Quase Acidente e Categoria Padronizada' }
    : { aceita: '.xlsx,.xlsm,.xls,.csv', titulo: 'Arraste a planilha de controle de acidentes ou clique para escolher', dica: 'XLSX, XLSM, XLS ou CSV — aba "Dados" (ou a primeira aba)' });
  const area = h('div', { class: 'stack' });
  const etapa1 = h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Os registros são conferidos antes de gravar: você vê o que é novo, o que já existe e o que tem erro. Nada é gravado até você confirmar.'),
    quase ? h('p', { class: 'muted small' }, 'A planilha só traz mês e ano: cada quase acidente é gravado com a data do último dia do mês.') : null,
    sel.elemento);
  montar(area, etapa1);
  let linhas = null;
  let mapaObras = {};
  let analise = null;
  const acoes = h('div', { class: 'row' });

  // De-para: preenchido por inteiro em `rascunho` e só aplicado à análise ao clicar em "Gravar associações".
  // O painel é criado uma vez por planilha, para os nomes não sumirem nem perderem o que foi digitado.
  let rascunho = {};
  const invalidos = new Set();
  let painelDePara = null;
  let statusDePara = null;
  let botaoGravar = null;
  let botaoImportar = null;
  let totalDePara = 0;

  const dePara = () => {
    const chaves = new Set([...Object.keys(rascunho), ...Object.keys(mapaObras)]);
    return { pendente: invalidos.size > 0 || [...chaves].some((k) => rascunho[k] !== mapaObras[k]), associadas: Object.keys(rascunho).length };
  };

  const atualizarDePara = () => {
    const { pendente, associadas } = dePara();
    if (statusDePara) {
      statusDePara.textContent = `${associadas} de ${totalDePara} associada(s)${pendente ? ' · alterações não gravadas' : associadas ? ' · gravadas' : ''}`;
      botaoGravar.disabled = !pendente;
    }
    if (botaoImportar) {
      botaoImportar.disabled = pendente || !analise?.totais.novos;
      botaoImportar.title = pendente ? 'Grave as associações de obras antes de importar' : '';
    }
  };

  const gravarDePara = async () => {
    if (invalidos.size) return toast('warning', 'Obra não encontrada', `Escolha uma obra da lista ou apague o texto em ${invalidos.size} campo(s).`);
    const anterior = mapaObras;
    mapaObras = { ...rascunho };
    botaoGravar.disabled = true;
    try {
      await analisar();
      toast('success', 'Associações gravadas', 'A conferência da planilha foi atualizada.');
    } catch (e) {
      mapaObras = anterior;
      atualizarDePara();
      toast('error', 'Não foi possível gravar as associações', e.message, 8000);
    }
    return undefined;
  };

  const criarPainelDePara = (obras) => {
    totalDePara = obras.length;
    statusDePara = h('span', { class: 'muted small', 'aria-live': 'polite' });
    botaoGravar = h('button', { class: 'btn primary', type: 'button', onclick: gravarDePara }, 'Gravar associações');
    painelDePara = h('div', { class: 'card card-pad stack seg-depara' },
      h('div', {}, h('b', {}, 'Obras da planilha que não estão no Cadastro de obras'),
        h('p', { class: 'muted small' }, 'Digite para buscar e associe cada nome a uma obra cadastrada (vale para todas as linhas com esse nome). Preencha o que precisar e clique em Gravar associações. Nomes em branco entram com o nome da planilha.')),
      h('div', { class: 'form-grade seg-depara-campos' }, obras.map((o) => campo(o.nome, buscaObra({
        cadastros,
        rotulo: o.nome,
        aoMudar: ({ id, invalido }) => {
          if (id) rascunho[o.chave] = id; else delete rascunho[o.chave];
          if (invalido) invalidos.add(o.chave); else invalidos.delete(o.chave);
          atualizarDePara();
        },
      })))),
      h('div', { class: 'seg-depara-rodape' }, statusDePara, botaoGravar));
  };

  const analisar = async () => {
    analise = await api.post('/seguranca/importacao/analisar', { linhas, mapaObras, modo });
    if (!painelDePara && analise.obrasNaoEncontradas.length) criarPainelDePara(analise.obrasNaoEncontradas);
    desenharPrevia();
  };

  const ler = async () => {
    const [arquivo] = sel.arquivos();
    if (!arquivo) return toast('warning', 'Escolha a planilha');
    try {
      linhas = (await linhasComoObjetos(arquivo, quase ? ['Base Consolidada', 'Base consolidada', 'BASE CONSOLIDADA'] : ['Dados'])).map(serializarLinha);
      if (!linhas.length) return toast('warning', 'Planilha sem linhas', `A aba "${quase ? 'Base Consolidada' : 'Dados'}" está vazia.`);
      if (quase && !ehPlanilhaQuase(linhas)) return toast('warning', 'Planilha fora do modelo', 'Use a aba "Base Consolidada", com as colunas Obra, Mês, Descrição do Quase Acidente e Categoria Padronizada.', 8000);
      await analisar();
    } catch (e) {
      toast('error', 'Não foi possível ler a planilha', e.message, 8000);
    }
  };

  const confirmarImportacao = async () => {
    try {
      const r = await api.post('/seguranca/importacao', { linhas, mapaObras, modo });
      m.fechar();
      const partes = [`${r.jaExistentes} já existente(s)`, `${r.repetidos} repetido(s) na planilha`, `${r.comErro} com erro (não importados)`];
      toast(r.comErro ? 'warning' : 'success', `${r.importados} ${nomeRegistros} importado(s)`, partes.join(' · '), 9000);
      aoImportar?.();
    } catch (e) {
      toast('error', 'Não foi possível importar', e.message, 8000);
    }
  };

  let mostrar = 'todos';
  const desenharPrevia = () => {
    const t = analise.totais;
    const situacoes = { novo: ['success', 'Novo'], existente: ['neutral', 'Já cadastrado'], repetido: ['warning', 'Repetido na planilha'], erro: ['error', 'Erro'] };
    const visiveis = analise.linhas.filter((l) => mostrar === 'todos' || l.situacao === mostrar);
    montar(area,
      h('div', { class: 'seg-import-totais' },
        [['todos', 'Linhas lidas', t.lidas, ''], ['novo', 'Novos (serão importados)', t.novos, 'ok'], ['existente', 'Já cadastrados', t.existentes, ''],
          ['repetido', 'Repetidos na planilha', t.repetidos, 'aviso'], ['erro', 'Com erro', t.erros, 'ruim']]
          .map(([chave, rotulo, valor, classe]) => h('button', { type: 'button', class: `seg-import-total ${classe}`, 'aria-pressed': String(mostrar === chave), onclick: () => { mostrar = chave; desenharPrevia(); } },
            h('span', {}, rotulo), h('b', {}, fmtNumero(valor))))),
      painelDePara,
      t.erros ? alerta('warning', `${t.erros} linha(s) com erro não serão importadas`, 'Corrija na planilha e importe de novo — as linhas já importadas serão reconhecidas.') : null,
      visiveis.length ? h('div', { class: 'sheet seg-previa' }, h('table', {},
        h('thead', {}, h('tr', {}, (quase ? ['Linha', 'Situação', 'Data', 'Obra', 'Categoria', 'Descrição', 'Observações']
          : ['Linha', 'Situação', 'Data', 'Obra', 'Acidentado', 'Tipo', 'Parte do corpo', 'Dias', 'Observações']).map((c) => h('th', {}, c)))),
        h('tbody', {}, visiveis.slice(0, 500).map((l) => h('tr', { class: `seg-previa-${l.situacao}` },
          h('td', {}, l.linha),
          h('td', { class: 'esq' }, badge(...[situacoes[l.situacao][1], situacoes[l.situacao][0]])),
          h('td', { class: 'esq' }, l.entrada.data ? (/^\d{4}-\d{2}-\d{2}$/.test(l.entrada.data) ? fmtData(l.entrada.data) : l.entrada.data) : VAZIO),
          h('td', { class: 'esq' }, l.entrada.obra || VAZIO),
          quase ? [
            h('td', { class: 'esq' }, l.acidente?.categoria ?? (l.entrada.categoria || VAZIO)),
            h('td', { class: 'texto' }, h('span', { class: 'seg-resumo', title: l.entrada.resumo }, l.entrada.resumo || VAZIO)),
          ] : [
            h('td', { class: 'esq' }, l.entrada.nomeAcidentado || VAZIO),
            h('td', { class: 'esq' }, l.acidente?.tipo ?? (l.entrada.tipo || VAZIO)),
            h('td', { class: 'esq' }, l.acidente?.parteCorpo ?? (l.entrada.parteCorpo || VAZIO)),
            h('td', {}, l.acidente?.diasAfastamento ?? (l.entrada.diasAfastamento || VAZIO)),
          ],
          h('td', { class: 'texto' }, [...l.erros.map((e) => h('div', { class: 'seg-msg erro' }, e)), ...l.avisos.map((a) => h('div', { class: 'seg-msg aviso' }, a))]))))))
        : h('p', { class: 'muted' }, 'Nenhuma linha nesta situação.'),
      visiveis.length > 500 ? h('p', { class: 'muted small' }, `Mostrando 500 de ${visiveis.length} linhas.`) : null);
    montar(acoes,
      h('button', { class: 'btn ghost', type: 'button', onclick: () => {
        analise = null; mapaObras = {}; rascunho = {}; invalidos.clear(); painelDePara = null; statusDePara = null; botaoGravar = null; botaoImportar = null;
        montar(area, etapa1); montar(acoes, botoesInicio());
      } }, 'Escolher outra planilha'),
      botaoImportar = botaoAcao(`Importar ${t.novos} ${nomeRegistros}`, confirmarImportacao, 'btn primary'));
    atualizarDePara();
  };

  const botoesInicio = () => [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'), botaoAcao('Conferir planilha', ler, 'btn primary')];
  montar(acoes, botoesInicio());
  const m = abrirModal({ titulo: quase ? 'Importar quase acidentes' : 'Importar acidentes', largo: true, conteudo: area, acoes: [acoes] });
}
