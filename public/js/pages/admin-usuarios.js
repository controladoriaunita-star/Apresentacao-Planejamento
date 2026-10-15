/**
 * Administração → Usuários (somente Dev): criar, mudar papel, desativar e redefinir senha.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtDataHora } from '../core/formato.js';
import { estado } from '../core/estado.js';
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
        h('thead', {}, h('tr', {}, h('th', { class: 'first' }, 'Nome'), h('th', {}, 'E-mail'), h('th', {}, 'Papel'), h('th', {}, 'Situação'), h('th', {}, 'Último acesso'), h('th', {}))),
        h('tbody', {}, usuarios.map((u) => h('tr', {},
          h('td', { class: 'first' }, u.nome),
          h('td', { class: 'esq' }, u.email),
          h('td', { class: 'esq' }, PAPEIS[u.papel]?.nome ?? u.papel),
          h('td', {}, u.ativo ? badge('Ativo', 'success') : badge('Inativo', 'neutral')),
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

function abrirForm(inicial, aoSalvar) {
  const editando = Boolean(inicial.id);
  const erro = h('div');
  const nome = h('input', { value: inicial.nome ?? '', autocomplete: 'off' });
  const email = h('input', { type: 'email', value: inicial.email ?? '', disabled: editando, autocomplete: 'off' });
  const papel = h('select', {}, Object.entries(PAPEIS).map(([k, p]) => h('option', { value: k, selected: k === (inicial.papel ?? 'viewer') }, p.nome)));
  const senha = h('input', { type: 'password', autocomplete: 'new-password', placeholder: editando ? 'Deixe vazio para manter' : 'Mínimo de 8 caracteres' });
  const ativo = h('input', { type: 'checkbox', checked: inicial.ativo !== false });
  const m = abrirModal({
    titulo: editando ? `Editar ${inicial.nome}` : 'Novo usuário',
    conteudo: h('div', { class: 'stack' }, erro,
      campo('Nome', nome), campo('E-mail', email), campo('Papel', papel),
      campo(editando ? 'Nova senha' : 'Senha inicial', senha, 'Combine a senha com a pessoa por um canal seguro.'),
      editando ? h('label', { class: 'check' }, ativo, 'Usuário ativo') : null),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      botaoAcao('Salvar', async () => {
        montar(erro);
        try {
          if (editando) await api.put(`/usuarios/${inicial.id}`, { nome: nome.value, papel: papel.value, ativo: ativo.checked, ...(senha.value ? { senha: senha.value } : {}) });
          else await api.post('/usuarios', { nome: nome.value, email: email.value, papel: papel.value, senha: senha.value });
          m.fechar();
          toast('success', 'Usuário salvo');
          aoSalvar();
        } catch (e) {
          montar(erro, alerta('error', 'Não foi possível salvar', e.message));
        }
      }, 'btn primary'),
    ],
  });
}
