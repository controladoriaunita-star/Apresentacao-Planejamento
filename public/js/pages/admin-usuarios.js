/**
 * Administração → Usuários (somente Dev): criar, mudar papel, desativar e redefinir senha.
 * Com o Supabase (`estado.convite`) o Dev não define senha: o usuário recebe um convite por e-mail e cria a sua.
 * v26: para o papel Viewer, escolhe quais obras (todas ou só as marcadas) e qual apresentação (Obra, Cliente ou
 * ambas) a pessoa vê — regras em domain/acesso.js, aplicadas pelo servidor.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtDataHora } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { APRESENTACOES } from '../domain/acesso.js';
import { PAPEIS } from '../domain/permissoes.js';
import { abrirModal, alerta, badge, botaoAcao, campo, carregando, confirmar, toast } from '../ui/componentes.js';

export async function renderAdminUsuarios(alvo) {
  const desenhar = async () => {
    montar(alvo, carregando(4));
    let usuarios;
    try {
      usuarios = await api.get('/usuarios');
    } catch (e) {
      return montar(alvo, alerta('error', 'Erro ao carregar', e.message));
    }
    montar(alvo,
      h('div', { class: 'titulo-pagina' },
        h('div', {}, h('h1', {}, 'Usuários'), h('p', {}, Object.values(PAPEIS).map((p) => `${p.nome}: ${p.descricao}`).join(' · '))),
        h('button', { class: 'btn primary', type: 'button', onclick: () => abrirForm({}, desenhar) }, 'Novo usuário')),
      h('div', { class: 'sheet' }, h('table', { class: 'lista-admin' },
        h('thead', {}, h('tr', {}, h('th', { class: 'first' }, 'Nome'), h('th', {}, 'E-mail'), h('th', {}, 'Papel'), h('th', {}, 'Acesso'), h('th', {}, 'Situação'), h('th', {}, 'Último acesso'), h('th', {}))),
        h('tbody', {}, usuarios.map((u) => h('tr', {},
          h('td', { class: 'first' }, u.nome),
          h('td', { class: 'esq' }, u.email),
          h('td', { class: 'esq' }, PAPEIS[u.papel]?.nome ?? u.papel),
          h('td', { class: 'esq' }, resumoAcesso(u)),
          h('td', {}, situacao(u)),
          h('td', { class: 'muted' }, fmtDataHora(u.ultimoAcesso)),
          h('td', { class: 'acoes' },
            h('button', { class: 'btn ghost sm', type: 'button', onclick: () => abrirForm(u, desenhar) }, 'Editar'),
            u.id !== estado.usuario.id ? h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => {
              if (!(await confirmar('Excluir usuário?', `${u.nome} perderá o acesso.`, { rotulo: 'Excluir', perigo: true }))) return;
              await api.del(`/usuarios/${u.id}`);
              toast('success', 'Usuário excluído');
              desenhar();
            } }, 'Excluir') : null)))))));
  };
  await desenhar();
}

function situacao(u) {
  if (!u.ativo) return badge('Inativo', 'neutral');
  return estado.convite && !u.ultimoAcesso ? badge('Convite enviado', 'warning') : badge('Ativo', 'success');
}

/** "Todas as obras · Obra e Cliente", "2 obras · Somente Cliente"… (só o Viewer é restrito). */
function resumoAcesso(u) {
  if (u.papel !== 'viewer') return h('span', { class: 'muted' }, 'Tudo');
  const obras = Array.isArray(u.obras) ? (u.obras.length === 1 ? '1 obra' : `${u.obras.length} obras`) : 'Todas as obras';
  return `${obras} · ${APRESENTACOES[u.apresentacoes] ?? APRESENTACOES.ambas}`;
}

/**
 * Obras e apresentação liberadas: "Todas as obras" (inclui as que entrarem depois) ou só as marcadas, agrupadas
 * por cliente com uma caixa que marca/desmarca o cliente inteiro.
 */
function seletorAcesso(inicial) {
  const obras = estado.base('obra')?.obras ?? [];
  const marcadas = new Set(Array.isArray(inicial.obras) ? inicial.obras : []);
  const conhecidas = new Set(obras.map((o) => o.chave));
  const apresentacoes = h('select', { 'aria-label': 'Apresentação' }, Object.entries(APRESENTACOES).map(([k, nome]) => h('option', { value: k, selected: k === (inicial.apresentacoes ?? 'ambas') }, nome)));
  const nomeRadio = `obras-${Math.random().toString(36).slice(2)}`;
  const todas = h('input', { type: 'radio', name: nomeRadio, checked: !Array.isArray(inicial.obras), onchange: () => atualizar() });
  const selecionadas = h('input', { type: 'radio', name: nomeRadio, checked: Array.isArray(inicial.obras), onchange: () => atualizar() });
  const contagem = h('small', { class: 'muted' });
  const lista = h('div', { class: 'acesso-obras', role: 'group', 'aria-label': 'Obras liberadas' });

  const grupos = new Map();
  for (const o of obras) {
    const g = o.cliente ?? 'Sem cliente';
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(o);
  }
  const desenharLista = () => montar(lista, [...grupos].map(([cliente, membros]) => {
    const n = membros.filter((o) => marcadas.has(o.chave)).length;
    const doCliente = h('input', { type: 'checkbox', checked: n === membros.length, onchange: (e) => {
      for (const o of membros) e.target.checked ? marcadas.add(o.chave) : marcadas.delete(o.chave);
      desenharLista();
    } });
    doCliente.indeterminate = n > 0 && n < membros.length;
    return h('div', { class: 'acesso-cliente' },
      h('label', { class: 'check' }, doCliente, h('b', {}, cliente), h('small', { class: 'muted' }, `${membros.length}`)),
      h('div', { class: 'acesso-membros' }, membros.map((o) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: marcadas.has(o.chave), onchange: (e) => { e.target.checked ? marcadas.add(o.chave) : marcadas.delete(o.chave); desenharLista(); } }),
        o.nome))));
  }));
  const atualizar = () => {
    lista.hidden = !selecionadas.checked;
    contagem.textContent = selecionadas.checked ? `${[...marcadas].filter((c) => conhecidas.has(c)).length} de ${obras.length} obras marcadas — nenhuma marcada = não vê nenhuma obra.` : 'Inclui as obras que entrarem depois na planilha.';
  };
  desenharLista();
  atualizar();

  const elemento = h('fieldset', { class: 'acesso-usuario stack', 'aria-label': 'Acesso do Viewer' },
    h('legend', {}, 'Acesso do Viewer'),
    campo('Apresentação', apresentacoes),
    h('div', { class: 'row' },
      h('label', { class: 'check' }, todas, 'Todas as obras'),
      h('label', { class: 'check' }, selecionadas, 'Somente as obras selecionadas')),
    contagem,
    lista);
  return {
    elemento,
    // Obras marcadas que sumiram da planilha continuam gravadas (voltam a valer se a obra reaparecer).
    valor: () => ({ obras: selecionadas.checked ? [...marcadas] : null, apresentacoes: apresentacoes.value }),
  };
}

function abrirForm(inicial, aoSalvar) {
  const editando = Boolean(inicial.id);
  const erro = h('div');
  const nome = h('input', { value: inicial.nome ?? '', autocomplete: 'off' });
  const email = h('input', { type: 'email', value: inicial.email ?? '', disabled: editando, autocomplete: 'off' });
  const papel = h('select', {}, Object.entries(PAPEIS).map(([k, p]) => h('option', { value: k, selected: k === (inicial.papel ?? 'viewer') }, p.nome)));
  const senha = h('input', { type: 'password', autocomplete: 'new-password', placeholder: editando ? 'Deixe vazio para manter' : 'Mínimo de 8 caracteres' });
  const ativo = h('input', { type: 'checkbox', checked: inicial.ativo !== false });
  const acessoViewer = seletorAcesso(inicial);
  const mostrarAcesso = () => { acessoViewer.elemento.hidden = papel.value !== 'viewer'; };
  papel.addEventListener('change', mostrarAcesso);
  mostrarAcesso();
  const acesso = estado.convite
    ? (editando
      ? botaoAcao('Reenviar e-mail de acesso', async () => {
        montar(erro);
        try {
          await api.post(`/usuarios/${inicial.id}/acesso`);
          toast('success', 'E-mail enviado', `Link para ${inicial.email} criar a senha.`);
        } catch (e) {
          montar(erro, alerta('error', 'Não foi possível enviar', e.message));
        }
      })
      : alerta('info', 'Convite por e-mail', 'A pessoa recebe um e-mail com o link para criar a própria senha.'))
    : campo(editando ? 'Nova senha' : 'Senha inicial', senha, 'Combine a senha com a pessoa por um canal seguro.');
  const m = abrirModal({
    titulo: editando ? `Editar ${inicial.nome}` : 'Novo usuário',
    conteudo: h('div', { class: 'stack' }, erro,
      campo('Nome', nome), campo('E-mail', email), campo('Papel', papel), acessoViewer.elemento, acesso,
      editando ? h('label', { class: 'check' }, ativo, 'Usuário ativo') : null),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      botaoAcao('Salvar', async () => {
        montar(erro);
        try {
          const liberado = papel.value === 'viewer' ? acessoViewer.valor() : {}; // os outros papéis veem tudo
          if (editando) await api.put(`/usuarios/${inicial.id}`, { nome: nome.value, papel: papel.value, ativo: ativo.checked, ...liberado, ...(senha.value ? { senha: senha.value } : {}) });
          else await api.post('/usuarios', { nome: nome.value, email: email.value, papel: papel.value, ...liberado, ...(estado.convite ? {} : { senha: senha.value }) });
          m.fechar();
          toast('success', 'Usuário salvo', !editando && estado.convite ? `Convite enviado para ${email.value}.` : null);
          aoSalvar();
        } catch (e) {
          montar(erro, alerta('error', 'Não foi possível salvar', e.message));
        }
      }, 'btn primary'),
    ],
  });
}
