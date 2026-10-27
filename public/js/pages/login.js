/**
 * Login, primeiro acesso (criação do primeiro usuário Dev quando ainda não há nenhum), "esqueci minha senha" e a
 * volta do link do e-mail (convite ou nova senha), que traz o token no endereço: `#access_token=…&type=invite`.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { alerta, campo } from '../ui/componentes.js';

/**
 * Lê (e apaga do endereço) o retorno do link do e-mail do Supabase: `{ token, tipo }` ou `{ erro }`; null se não houver.
 */
export function retornoDoEmail() {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('access_token');
  const erro = params.get('error_description');
  if (!token && !erro) return null;
  history.replaceState(null, '', location.pathname + location.search);
  if (token) return { token, tipo: params.get('type') };
  return { erro: /expired|invalid/i.test(erro) ? 'O link expirou ou já foi usado. Peça um novo.' : erro };
}

function telaAcesso(alvo, form) {
  montar(alvo, h('div', { class: 'login' },
    h('img', { class: 'padrao', src: 'assets/brand/pattern-un.png', alt: '', 'aria-hidden': 'true' }),
    h('div', { class: 'card' },
      h('img', { class: 'logo', src: 'assets/brand/logo-unita.png', alt: 'Unità Engenharia' }),
      h('div', { class: 'eyebrow' }, 'Planejamento e Controle'),
      h('h1', { style: { margin: '4px 0 20px' } }, 'Apresentação de obras'),
      form)));
}

/** Formulário com envio assíncrono: desabilita o botão e mostra o erro da API acima dos campos. */
function formulario(botao, enviar, ...conteudo) {
  const erro = h('div');
  return h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    montar(erro);
    botao.disabled = true;
    try {
      await enviar(erro);
    } catch (err) {
      montar(erro, alerta('error', err.message));
    }
    botao.disabled = false;
  } }, erro, ...conteudo, botao);
}

export function renderLogin(alvo, { precisaConfigurar, convite, aviso, aoEntrar }) {
  const nome = h('input', { autocomplete: 'name', required: true });
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const senha = h('input', { type: 'password', autocomplete: precisaConfigurar ? 'new-password' : 'current-password', required: true });
  const botao = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%' } }, precisaConfigurar ? 'Criar acesso Dev' : 'Entrar');

  const form = formulario(botao, async () => {
    const r = precisaConfigurar
      ? await api.post('/auth/configurar', { nome: nome.value, email: email.value, senha: senha.value })
      : await api.post('/auth/login', { email: email.value, senha: senha.value });
    aoEntrar(r.usuario);
  },
  precisaConfigurar ? alerta('info', 'Primeiro acesso', 'Crie o usuário Dev, que depois cadastra os demais.') : null,
  aviso ? alerta('warning', aviso) : null,
  precisaConfigurar ? campo('Nome', nome) : null,
  campo('E-mail', email),
  campo('Senha', senha, precisaConfigurar ? 'Mínimo de 8 caracteres' : null));
  if (convite && !precisaConfigurar) {
    form.append(h('button', { class: 'btn ghost sm', type: 'button', onclick: () => renderEsqueci(alvo, { email: email.value, voltar: () => renderLogin(alvo, { precisaConfigurar, convite, aoEntrar }) }) }, 'Esqueci minha senha'));
  }
  telaAcesso(alvo, form);
  (precisaConfigurar ? nome : email).focus();
}

function renderEsqueci(alvo, { email: inicial, voltar }) {
  const email = h('input', { type: 'email', autocomplete: 'username', required: true, value: inicial });
  const botao = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%' } }, 'Enviar link');
  const form = formulario(botao, async (erro) => {
    await api.post('/auth/recuperar', { email: email.value });
    montar(erro, alerta('success', 'Pedido enviado', 'Se o e-mail estiver cadastrado, chega em instantes um link para criar a nova senha. Confira também o lixo eletrônico.'));
  },
  h('p', { class: 'muted', style: { margin: 0 } }, 'Informe seu e-mail para receber o link de nova senha.'),
  campo('E-mail', email));
  form.append(h('button', { class: 'btn ghost sm', type: 'button', onclick: voltar }, 'Voltar ao login'));
  telaAcesso(alvo, form);
  email.focus();
}

/** Volta do link do e-mail: a pessoa cria a senha e já entra. */
export function renderDefinirSenha(alvo, { token, tipo, aoEntrar }) {
  const senha = h('input', { type: 'password', autocomplete: 'new-password', required: true });
  const repetir = h('input', { type: 'password', autocomplete: 'new-password', required: true });
  const botao = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%' } }, 'Salvar senha e entrar');
  telaAcesso(alvo, formulario(botao, async () => {
    if (senha.value !== repetir.value) throw new Error('As senhas não conferem.');
    const r = await api.post('/auth/definir-senha', { token, senha: senha.value });
    aoEntrar(r.usuario);
  },
  alerta('info', tipo === 'invite' ? 'Bem-vindo(a)!' : 'Nova senha', tipo === 'invite' ? 'Crie a sua senha para acessar o app.' : 'Crie uma nova senha para continuar.'),
  campo('Nova senha', senha, 'Mínimo de 8 caracteres'),
  campo('Repita a senha', repetir)));
  senha.focus();
}
