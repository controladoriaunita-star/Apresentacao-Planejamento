/**
 * Administração → Cadastro de obras: áreas, UH, INCC base, prazos e equipe (dados que não estão nas
 * abas do SharePoint). Edição por formulário ou importação da planilha "Painel de Obras".
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtDataHora } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { CAMPOS_CADASTRO, GRUPOS_CADASTRO } from '../domain/cadastro-obra.js';
import { abrirModal, alerta, badge, botaoAcao, campo, confirmar, toast } from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { linhasComoObjetos } from '../ui/planilha.js';
import { seletorArquivos } from '../ui/seletor-arquivos.js';

export function renderAdminCadastro(alvo) {
  const base = estado.base('obra');
  const cadastros = estado.bruto?.cadastro ?? [];
  const porChave = new Map(cadastros.map((c) => [c.chave, c]));
  const recarregar = async () => { await estado.carregarDados(); };

  const importarPlanilha = async ([arquivo]) => {
    if (!arquivo) return;
    try {
      const linhas = await linhasComoObjetos(arquivo, ['Painel de Obras', 'BD_Fixo']);
      const r = await api.post('/obras/cadastro/importar', { linhas });
      toast('success', `${r.importados} obra(s) importada(s)`, r.obras.slice(0, 6).join(', '));
      await recarregar();
    } catch (err) {
      toast('error', 'Não foi possível importar', err.message, 8000);
    }
  };
  const abrirImportacao = () => {
    const sel = seletorArquivos({ aceita: '.xlsx,.xlsm,.xls,.csv', titulo: 'Arraste a planilha "Painel de Obras" ou clique para escolher', dica: 'XLSX, XLSM, XLS ou CSV — aba "Painel de Obras", "BD_Fixo" ou a primeira aba' });
    const m = abrirModal({
      titulo: 'Importar cadastro de obras',
      conteudo: h('div', { class: 'stack' },
        h('p', { class: 'muted' }, 'Usa os mesmos cabeçalhos da planilha do Power BI. Obras já cadastradas são atualizadas.'),
        sel.elemento),
      acoes: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
        botaoAcao('Importar', async () => { if (!sel.arquivos().length) return toast('warning', 'Escolha a planilha'); await importarPlanilha(sel.arquivos()); m.fechar(); }, 'btn primary'),
      ],
    });
  };

  // Obras das planilhas + obras só cadastradas
  const linhas = base.obras.map((o) => ({ obra: o, cadastro: porChave.get(o.chave) }));
  montar(alvo,
    h('div', { class: 'titulo-pagina' },
      h('div', {}, h('h1', {}, 'Cadastro de obras'),
        h('p', {}, 'Nº de UH, áreas, INCC base, prazos e equipe. Usados em Custos por, INCC, NH-NU, unidades no mês e "+ Infos da obra".')),
      h('div', { class: 'row' },
        h('button', { class: 'btn secondary', type: 'button', onclick: abrirImportacao }, icone('enviar', { tamanho: 16 }), 'Importar planilha'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => abrirForm({}, recarregar) }, 'Nova obra'))),
    h('div', { class: 'sheet', style: { marginTop: '16px' } }, h('table', { class: 'lista-admin' },
      h('thead', {}, h('tr', {}, h('th', { class: 'first' }, 'Obra'), h('th', {}, 'Cliente'), h('th', {}, 'Nº UH'), h('th', {}, 'Área equiv.'), h('th', {}, 'INCC base'), h('th', {}, 'Atualizado'), h('th', {}))),
      h('tbody', {}, linhas.map(({ obra, cadastro }) => h('tr', {},
        h('td', { class: 'first' }, obra.nome, cadastro ? null : [' ', badge('sem cadastro', 'warning')]),
        h('td', { class: 'esq' }, cadastro?.cliente ?? obra.cliente ?? '—'),
        h('td', {}, cadastro?.numeroUH ?? '—'),
        h('td', {}, cadastro?.areaEquivalente ?? '—'),
        h('td', {}, cadastro?.inccBase ?? '—'),
        h('td', { class: 'muted' }, cadastro ? fmtDataHora(cadastro.atualizadoEm) : '—'),
        h('td', { class: 'acoes' },
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => abrirForm(cadastro ?? { obra: obra.nome, cliente: obra.cliente, uau: obra.uau }, recarregar) }, cadastro ? 'Editar' : 'Cadastrar'),
          cadastro ? h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => {
            if (!(await confirmar('Excluir cadastro?', `Os dados de cadastro de ${obra.nome} serão apagados (as planilhas não mudam).`, { rotulo: 'Excluir', perigo: true }))) return;
            await api.del(`/obras/cadastro/${cadastro.id}`);
            await recarregar();
          } }, 'Excluir') : null)))))));
}

function abrirForm(inicial, aoSalvar) {
  const controles = new Map();
  const erro = h('div');
  const controle = (def) => {
    const valor = inicial[def.campo] ?? '';
    if (def.tipo === 'opcao') return h('select', {}, def.opcoes.map((o) => h('option', { value: o, selected: o === valor }, o || 'Automática')));
    if (def.tipo === 'data') return h('input', { type: 'date', value: valor ? String(valor).slice(0, 10) : '' });
    return h('input', { value: valor, inputmode: def.tipo === 'numero' ? 'decimal' : null });
  };
  const grupos = GRUPOS_CADASTRO.map((grupo) => h('div', { class: 'form-grupo' }, h('p', { class: 'sub' }, grupo),
    h('div', { class: 'form-grade' }, CAMPOS_CADASTRO.filter((c) => c.grupo === grupo).map((def) => {
      const el = controle(def);
      controles.set(def.campo, el);
      return campo(def.rotulo + (def.obrigatorio ? ' *' : ''), el, def.usadoEm ? `Usado em: ${def.usadoEm}` : def.ajuda ?? null);
    }))));
  const m = abrirModal({
    titulo: inicial.id ? `Cadastro — ${inicial.obra}` : 'Cadastro de obra',
    largo: true,
    conteudo: h('div', {}, erro, grupos),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      botaoAcao('Salvar', async () => {
        montar(erro);
        try {
          await api.put('/obras/cadastro', Object.fromEntries([...controles].map(([k, el]) => [k, el.value])));
          m.fechar();
          toast('success', 'Cadastro salvo');
          await aoSalvar();
        } catch (e) {
          montar(erro, alerta('error', 'Não foi possível salvar', e.message));
        }
      }, 'btn primary'),
    ],
  });
}
