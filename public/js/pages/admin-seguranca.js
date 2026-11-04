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
  CABECALHOS_MODELO, dadosDaObra, FASES_OBRA, PARTES_CORPO, pendenciasDaObra, TIPOS_ACIDENTE, validarAcidente,
} from '../domain/seguranca.js';
import { abrirModal, alerta, badge, botaoAcao, campo, carregando, confirmar, toast, vazio } from '../ui/componentes.js';
import { filtroExcel } from '../ui/filtro-excel.js';
import { icone } from '../ui/icones.js';
import { baixarPlanilha, linhasComoObjetos } from '../ui/planilha.js';
import { seletorArquivos } from '../ui/seletor-arquivos.js';

const NOME_TIPO = Object.fromEntries(TIPOS_ACIDENTE.map((t) => [t.sigla, t.nome]));
const COR_TIPO = { CPT: 'info', SPT: 'success', TRJ: 'primary', FT: 'error' };

/** Filtros da tabela histórica (lembrados enquanto a aba estiver aberta). */
const filtro = { obras: null, de: '', ate: '', tipos: [], nome: '', empresa: '', ordem: 'desc', pagina: 1 };

const cadastrosDaObra = () => (estado.bruto?.cadastro ?? []).filter((c) => c.id).sort((a, b) => a.obra.localeCompare(b.obra, 'pt-BR'));
export const seloTipo = (sigla) => h('span', { class: `badge b-${COR_TIPO[sigla] ?? 'neutral'}`, title: NOME_TIPO[sigla] ?? '' }, sigla);

export async function renderAdminSeguranca(alvo) {
  const cadastros = cadastrosDaObra();
  const incompletos = cadastros.filter((c) => pendenciasDaObra(c).length);
  const resultado = h('div', { class: 'seg-historico' });

  const recarregar = () => carregarTabela(resultado, cadastros, recarregar);
  montar(alvo,
    h('div', { class: 'titulo-pagina' },
      h('div', {}, h('h1', {}, 'Segurança do Trabalho'),
        h('p', {}, 'Acidentes por obra: cadastro, importação da planilha de controle e histórico. Alimenta o Dashboard Segurança e a aba Segurança do Trabalho.')),
      h('div', { class: 'row' },
        h('a', { class: 'btn secondary', href: '#/admin/seguranca-dashboard' }, icone('escudo', { tamanho: 16 }), 'Dashboard Segurança'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => baixarModelo(cadastros) }, icone('planilha', { tamanho: 16 }), 'Baixar modelo'),
        h('button', { class: 'btn secondary', type: 'button', onclick: () => abrirImportacao(cadastros, recarregar) }, icone('enviar', { tamanho: 16 }), 'Importar planilha'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => abrirFormAcidente({}, cadastros, recarregar) }, 'Novo acidente'))),
    cadastros.length ? null : alerta('warning', 'Nenhuma obra no Cadastro de obras', 'Cadastre as obras em Administração → Cadastro de obras antes de registrar acidentes.'),
    incompletos.length ? alerta('info', `${incompletos.length} obra(s) sem Cliente ou Sistema estrutural no Cadastro de obras`,
      `Elas não recebem acidentes até o cadastro ser completado: ${incompletos.slice(0, 6).map((c) => c.obra).join(', ')}${incompletos.length > 6 ? '…' : ''}.`) : null,
    resultado);
  await recarregar();
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
        cab('Nome da empresa'), cab('Tipo'), cab('Parte do corpo'), cab('Dias de afastamento'), cab('Resumo do acidente'), h('th', {}))),
      h('tbody', {}, r.itens.map((a) => h('tr', {},
        h('td', { class: 'esq seg-col-data' }, fmtData(a.data)),
        h('td', { class: 'esq' }, a.obra ?? VAZIO),
        h('td', { class: 'esq' }, a.incorporador ?? VAZIO),
        h('td', { class: 'esq' }, a.metodoConstrutivo ?? VAZIO),
        h('td', { class: 'esq' }, a.faseObra),
        h('td', { class: 'esq' }, a.nomeAcidentado),
        h('td', { class: 'esq' }, a.funcao),
        h('td', { class: 'esq' }, a.empresa),
        h('td', { class: 'esq' }, seloTipo(a.tipo)),
        h('td', { class: 'esq' }, a.parteCorpo),
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
      rotulo: 'Tipo do acidente', itens: TIPOS_ACIDENTE.map((t) => ({ valor: t.sigla, rotulo: `${t.sigla} – ${t.nome}` })),
      selecionados: filtro.tipos.length ? filtro.tipos : TIPOS_ACIDENTE.map((t) => t.sigla), multiplo: true, largura: 320,
      aoAplicar: (v) => { filtro.tipos = v.length === TIPOS_ACIDENTE.length ? [] : v; aplicar(); },
    }),
    busca('Acidentado', 'nome', 'Pesquisar nome…'),
    busca('Empresa', 'empresa', 'Pesquisar empresa…'),
    h('button', { class: 'btn ghost sm', type: 'button', onclick: limpar }, 'Limpar filtros'));
}

async function excluir(a, recarregar) {
  if (!(await confirmar('Excluir acidente?', `O acidente de ${a.nomeAcidentado} em ${fmtData(a.data)} (${a.obra}) será apagado e sai dos indicadores.`, { rotulo: 'Excluir', perigo: true }))) return;
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
    titulo: `Acidente — ${a.nomeAcidentado}`,
    largo: true,
    conteudo: h('div', { class: 'stack' },
      h('dl', { class: 'detalhe-valores seg-detalhe' },
        item('Data', fmtData(a.data)), item('Obra', a.obra), item('Incorporador', a.incorporador), item('Método construtivo', a.metodoConstrutivo),
        item('Fase da obra', a.faseObra), item('Função', a.funcao), item('Nome da empresa', a.empresa), item('Tipo do acidente', `${a.tipo} – ${NOME_TIPO[a.tipo]}`),
        item('Parte do corpo atingida', a.parteCorpo), item('Dias de afastamento', fmtNumero(a.diasAfastamento)),
        item('Origem', a.origem === 'importacao' ? 'Importação de planilha' : 'Cadastro manual'), item('Registrado', `${fmtDataHora(a.criadoEm)}${a.criadoPor ? ` · ${a.criadoPor}` : ''}`)),
      h('div', { class: 'comentario-caixa' }, h('b', {}, 'Resumo do acidente'), h('p', {}, a.resumo)),
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
    h('option', { value: '', disabled: true, selected: !inicial.obraId }, 'Selecione a obra'),
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
  const data = h('input', { type: 'date', value: inicial.data ?? '', max: new Date().toISOString().slice(0, 10), required: true });
  const fase = h('select', { required: true }, opcoes(FASES_OBRA.map((f) => [f, f]), inicial.faseObra, 'Selecione a fase'));
  const nome = h('input', { value: inicial.nomeAcidentado ?? '', required: true, maxlength: 160, autocomplete: 'off' });
  const tipo = h('select', { required: true }, opcoes(TIPOS_ACIDENTE.map((t) => [t.sigla, `${t.sigla} – ${t.nome}`]), inicial.tipo, 'Selecione o tipo'));
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
      parteCorpo: parte.value, empresa: empresa.value, diasAfastamento: dias.value === '' ? null : Number(dias.value), resumo: resumo.value,
    };
    const { erros } = validarAcidente(corpo);
    if (erros.length) return montar(erro, alerta('error', 'Revise os campos obrigatórios', h('ul', { class: 'seg-erros' }, erros.map((e) => h('li', {}, e)))));
    try {
      if (editando) await api.put(`/seguranca/acidentes/${inicial.id}`, corpo);
      else await api.post('/seguranca/acidentes', corpo);
      m.fechar();
      toast('success', editando ? 'Acidente atualizado' : 'Acidente registrado', 'Os indicadores já consideram este registro.');
      aoSalvar?.();
    } catch (e) {
      montar(erro, alerta('error', 'Não foi possível salvar', e.message));
    }
  };

  const obrig = (rotulo) => `${rotulo} *`;
  const m = abrirModal({
    titulo: editando ? 'Editar acidente' : 'Novo acidente',
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
          campo(obrig('Fase da obra'), fase))),
      h('div', { class: 'form-grupo' }, h('p', { class: 'sub' }, 'Acidentado e ocorrência'),
        h('div', { class: 'form-grade' },
          campo(obrig('Nome do acidentado'), nome),
          campo(obrig('Função'), funcao),
          campo(obrig('Nome da empresa'), empresa),
          campo(obrig('Tipo do acidente'), tipo),
          campo(obrig('Parte do corpo atingida'), parte),
          campo(obrig('Nº de dias de afastamento'), dias, 'Inteiro, 0 ou mais'))),
      campo(obrig('Resumo do acidente'), resumo)),
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

function abrirImportacao(cadastros, aoImportar) {
  const sel = seletorArquivos({ aceita: '.xlsx,.xlsm,.xls,.csv', titulo: 'Arraste a planilha de controle de acidentes ou clique para escolher', dica: 'XLSX, XLSM, XLS ou CSV — aba "Dados" (ou a primeira aba)' });
  const area = h('div', { class: 'stack' });
  const etapa1 = h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Os registros são conferidos antes de gravar: você vê o que é novo, o que já existe e o que tem erro. Nada é gravado até você confirmar.'),
    sel.elemento);
  montar(area, etapa1);
  let linhas = null;
  let mapaObras = {};
  let analise = null;
  const acoes = h('div', { class: 'row' });

  const analisar = async () => {
    analise = await api.post('/seguranca/importacao/analisar', { linhas, mapaObras });
    desenharPrevia();
  };

  const ler = async () => {
    const [arquivo] = sel.arquivos();
    if (!arquivo) return toast('warning', 'Escolha a planilha');
    try {
      linhas = (await linhasComoObjetos(arquivo, ['Dados'])).map(serializarLinha);
      if (!linhas.length) return toast('warning', 'Planilha sem linhas', 'A aba "Dados" está vazia.');
      await analisar();
    } catch (e) {
      toast('error', 'Não foi possível ler a planilha', e.message, 8000);
    }
  };

  const confirmarImportacao = async () => {
    try {
      const r = await api.post('/seguranca/importacao', { linhas, mapaObras });
      m.fechar();
      const partes = [`${r.jaExistentes} já existente(s)`, `${r.repetidos} repetido(s) na planilha`, `${r.comErro} com erro (não importados)`];
      toast(r.comErro ? 'warning' : 'success', `${r.importados} acidente(s) importado(s)`, partes.join(' · '), 9000);
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
    const deParaObras = analise.obrasNaoEncontradas.length ? h('div', { class: 'card card-pad stack seg-depara' },
      h('div', {}, h('b', {}, 'Obras da planilha que não estão no Cadastro de obras'),
        h('p', { class: 'muted small' }, 'Associe cada nome a uma obra cadastrada (vale para todas as linhas com esse nome) ou deixe sem associação para não importar.')),
      h('div', { class: 'form-grade' }, analise.obrasNaoEncontradas.map((o) => campo(o.nome, h('select', {
        onchange: async (e) => { if (e.target.value) mapaObras[o.chave] = e.target.value; else delete mapaObras[o.chave]; await analisar(); },
      }, h('option', { value: '' }, '— sem associação —'), cadastros.map((c) => h('option', { value: c.id, selected: mapaObras[o.chave] === c.id }, c.obra))))))) : null;
    montar(area,
      h('div', { class: 'seg-import-totais' },
        [['todos', 'Linhas lidas', t.lidas, ''], ['novo', 'Novos (serão importados)', t.novos, 'ok'], ['existente', 'Já cadastrados', t.existentes, ''],
          ['repetido', 'Repetidos na planilha', t.repetidos, 'aviso'], ['erro', 'Com erro', t.erros, 'ruim']]
          .map(([chave, rotulo, valor, classe]) => h('button', { type: 'button', class: `seg-import-total ${classe}`, 'aria-pressed': String(mostrar === chave), onclick: () => { mostrar = chave; desenharPrevia(); } },
            h('span', {}, rotulo), h('b', {}, fmtNumero(valor))))),
      deParaObras,
      t.erros ? alerta('warning', `${t.erros} linha(s) com erro não serão importadas`, 'Corrija na planilha e importe de novo — as linhas já importadas serão reconhecidas.') : null,
      visiveis.length ? h('div', { class: 'sheet seg-previa' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Linha', 'Situação', 'Data', 'Obra', 'Acidentado', 'Tipo', 'Parte do corpo', 'Dias', 'Observações'].map((c) => h('th', {}, c)))),
        h('tbody', {}, visiveis.slice(0, 500).map((l) => h('tr', { class: `seg-previa-${l.situacao}` },
          h('td', {}, l.linha),
          h('td', { class: 'esq' }, badge(...[situacoes[l.situacao][1], situacoes[l.situacao][0]])),
          h('td', { class: 'esq' }, l.entrada.data ? (/^\d{4}-\d{2}-\d{2}$/.test(l.entrada.data) ? fmtData(l.entrada.data) : l.entrada.data) : VAZIO),
          h('td', { class: 'esq' }, l.entrada.obra || VAZIO),
          h('td', { class: 'esq' }, l.entrada.nomeAcidentado || VAZIO),
          h('td', { class: 'esq' }, l.acidente?.tipo ?? (l.entrada.tipo || VAZIO)),
          h('td', { class: 'esq' }, l.acidente?.parteCorpo ?? (l.entrada.parteCorpo || VAZIO)),
          h('td', {}, l.acidente?.diasAfastamento ?? (l.entrada.diasAfastamento || VAZIO)),
          h('td', { class: 'texto' }, [...l.erros.map((e) => h('div', { class: 'seg-msg erro' }, e)), ...l.avisos.map((a) => h('div', { class: 'seg-msg aviso' }, a))]))))))
        : h('p', { class: 'muted' }, 'Nenhuma linha nesta situação.'),
      visiveis.length > 500 ? h('p', { class: 'muted small' }, `Mostrando 500 de ${visiveis.length} linhas.`) : null);
    montar(acoes,
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { analise = null; mapaObras = {}; montar(area, etapa1); montar(acoes, botoesInicio()); } }, 'Escolher outra planilha'),
      botaoAcao(`Importar ${t.novos} acidente(s)`, confirmarImportacao, 'btn primary'));
    acoes.lastChild.disabled = !t.novos;
  };

  const botoesInicio = () => [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'), botaoAcao('Conferir planilha', ler, 'btn primary')];
  montar(acoes, botoesInicio());
  const m = abrirModal({ titulo: 'Importar acidentes', largo: true, conteudo: area, acoes: [acoes] });
}
