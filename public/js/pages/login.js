/**
 * Login e primeiro acesso (criação do primeiro usuário Dev quando ainda não há nenhum).
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { alerta, campo } from '../ui/componentes.js';

export function renderLogin(alvo, { precisaConfigurar, aoEntrar }) {
  const erro = h('div');
  const nome = h('input', { autocomplete: 'name', required: true });
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const senha = h('input', { type: 'password', autocomplete: precisaConfigurar ? 'new-password' : 'current-password', required: true });
  const botao = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%' } }, precisaConfigurar ? 'Criar acesso Dev' : 'Entrar');

  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    montar(erro);
    botao.disabled = true;
    try {
      const r = precisaConfigurar
        ? await api.post('/auth/configurar', { nome: nome.value, email: email.value, senha: senha.value })
        : await api.post('/auth/login', { email: email.value, senha: senha.value });
      aoEntrar(r.usuario);
    } catch (err) {
      montar(erro, alerta('error', err.message));
      botao.disabled = false;
    }
  } },
  precisaConfigurar ? alerta('info', 'Primeiro acesso', 'Crie o usuário Dev, que depois cadastra os demais.') : null,
  erro,
  precisaConfigurar ? campo('Nome', nome) : null,
  campo('E-mail', email),
  campo('Senha', senha, precisaConfigurar ? 'Mínimo de 8 caracteres' : null),
  botao);

  montar(alvo, h('div', { class: 'login' },
    h('img', { class: 'padrao', src: 'assets/brand/pattern-un.png', alt: '', 'aria-hidden': 'true' }),
    h('div', { class: 'card' },
      h('img', { class: 'logo', src: 'assets/brand/logo-unita.png', alt: 'Unità Engenharia' }),
      h('div', { class: 'eyebrow' }, 'Planejamento e Controle'),
      h('h1', { style: { margin: '4px 0 20px' } }, 'Apresentação de obras'),
      form)));
  (precisaConfigurar ? nome : email).focus();
}
