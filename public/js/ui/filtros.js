/**
 * Barra de filtros comum às abas, no estilo do AutoFiltro do Excel:
 * obras (várias, com pesquisa e agrupadas por cliente), período dos gráficos e mês de referência
 * (agrupados por ano).
 */
import { h } from '../core/dom.js';
import { fmtDataHora, fmtMes } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { mesesDasObras } from '../domain/base.js';
import { intervaloMeses } from '../domain/normalizar.js';
import { pode } from '../domain/permissoes.js';
import { botaoAcao, toast } from './componentes.js';
import { filtroExcel } from './filtro-excel.js';
import { icone } from './icones.js';

/** Itens de mês para o filtro, agrupados por ano (como a árvore de datas do Excel). */
export function itensDeMes(meses) {
  return meses.map((m) => ({ valor: m, rotulo: fmtMes(m), grupo: m.slice(0, 4) }));
}

export function itensDeObras(base) {
  return base.obras.map((o) => ({ valor: o.chave, rotulo: o.nome, grupo: o.cliente ?? 'Sem cliente' }));
}

export function barraFiltros({ mostrarPeriodo = true } = {}) {
  const base = estado.base('obra');
  const { obras, de, ate, referencia } = estado.filtro;
  const meses = mesesDasObras(base, obras);
  const todosMeses = itensDeMes(meses.length ? intervaloMeses(meses[0], meses.at(-1)) : []);

  return h('div', { class: 'filtros', role: 'search' },
    filtroExcel({
      rotulo: 'Obras', itens: itensDeObras(base), selecionados: obras, multiplo: true, testeId: 'filtro-obras', largura: 340,
      aoAplicar: (valores) => estado.definirFiltro({ obras: valores }),
    }),
    mostrarPeriodo ? filtroExcel({ rotulo: 'De', itens: todosMeses, selecionados: de, multiplo: false, largura: 200, aoAplicar: (v) => estado.definirFiltro({ de: v }) }) : null,
    mostrarPeriodo ? filtroExcel({ rotulo: 'Até', itens: todosMeses, selecionados: ate, multiplo: false, largura: 200, aoAplicar: (v) => estado.definirFiltro({ ate: v }) }) : null,
    filtroExcel({
      rotulo: 'Mês de referência', itens: todosMeses, selecionados: referencia, multiplo: false, testeId: 'mes-referencia', largura: 220, destaque: true,
      aoAplicar: (v) => estado.definirFiltro({ referencia: v }),
    }),
    h('div', { class: 'info' },
      h('span', { class: 'muted small' }, `${estado.bruto?.fonte ?? ''} · lido em ${fmtDataHora(estado.bruto?.atualizadoEm)}`),
      pode(estado.usuario?.papel, 'editarConteudo')
        ? botaoAcao([icone('atualizar', { tamanho: 16 }), 'Atualizar dados'], async () => {
          await estado.carregarDados({ forcarServidor: true });
          if (!estado.erro) toast('success', 'Dados atualizados do SharePoint');
        }, 'btn ghost sm so-edicao')
        : null));
}

/** Nas abas de uma obra só (Físico, Econômico, TxC, Fotos): escolhe entre as obras filtradas. */
export function obraUnica(base, aoTrocar) {
  const obras = base.obras.filter((o) => estado.filtro.obras.includes(o.chave));
  const atual = obras.find((o) => o.chave === estado.filtro.obraUnica) ?? obras[0] ?? null;
  const seletor = obras.length > 1
    ? filtroExcel({
      rotulo: 'Obra exibida', multiplo: false, largura: 300,
      itens: obras.map((o) => ({ valor: o.chave, rotulo: o.nome, grupo: o.cliente ?? 'Sem cliente' })),
      selecionados: atual?.chave,
      aoAplicar: (v) => { estado.filtro.obraUnica = v; aoTrocar(); },
    })
    : null;
  return { obra: atual, seletor };
}

