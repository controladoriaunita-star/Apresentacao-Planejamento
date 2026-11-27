/**
 * Login, primeiro acesso (criação do primeiro usuário Dev quando ainda não há nenhum), "esqueci minha senha" e a
 * volta do link do e-mail (convite ou nova senha), que traz o token no endereço: `#access_token=…&type=invite`.
 * v35: com o login Microsoft ativo, o botão "Entrar com a conta Microsoft" vem primeiro; e-mail e senha ficam para
 * quem não tem conta no 365 (clientes) e só abrem no botão "Cliente".
 */
import { api } from '../core/api.js';
import { h, montar, svg } from '../core/dom.js';
import { alerta, campo } from '../ui/componentes.js';
import { dentroDeIframe, entrarComMicrosoft, prepararPopup } from './login-microsoft.js';

/**
 * Lê (e apaga do endereço) o retorno do link do e-mail do Supabase: `{ token, tipo }` ou `{ erro }`; null se não houver.
 */
export function retornoDoEmail() {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('access_token');
  const tokenHash = params.get('token_hash'); // v36.2: link do e-mail enviado pelo 365
  const erro = params.get('error_description');
  if (!token && !tokenHash && !erro) return null;
  history.replaceState(null, '', location.pathname + location.search);
  if (tokenHash) return { token: tokenHash, hash: true, tipo: params.get('type') };
  if (token) return { token, tipo: params.get('type') };
  return { erro: /expired|invalid/i.test(erro) ? 'O link expirou ou já foi usado. Peça um novo.' : erro };
}

/**
 * Moldura da tela de entrada no modelo do "Kit - Tela de Login Unità" (css/unita-login.css, classes `ul-`):
 * painel grafite da marca à esquerda (faixa no topo no celular) e o cartão de acesso à direita. Só desenha:
 * os formulários e botões de entrar continuam os do app, dentro de `.ul-conteudo`.
 */
function telaAcesso(alvo, form, { titulo = 'Bem-vindo', subtitulo = 'Entre para acessar a apresentação das obras.' } = {}) {
  montar(alvo, h('div', { class: 'ul-login' },
    h('aside', { class: 'ul-marca' },
      h('img', { class: 'ul-padrao', src: 'assets/brand/pattern-un.png', alt: '', 'aria-hidden': 'true' }),
      h('img', { class: 'ul-logo', src: 'assets/brand/logo-unita-white.png', alt: 'Unità Engenharia' }),
      h('div', { class: 'ul-marca-texto' },
        h('p', { class: 'ul-sobretitulo' }, 'Planejamento e Controle'),
        h('h2', {}, 'Apresentação de obras'),
        h('p', {}, 'Avanço físico, econômico, prazos e fotos de cada obra, num só lugar.'))),
    h('section', { class: 'ul-acesso' },
      h('div', { class: 'ul-cartao' },
        h('p', { class: 'ul-sobretitulo' }, 'Unità · Planejamento'),
        h('h1', {}, titulo),
        subtitulo ? h('p', { class: 'ul-subtitulo' }, subtitulo) : null,
        h('div', { class: 'ul-conteudo' }, form)),
      h('p', { class: 'ul-rodape' }, 'Unità Engenharia · uso interno'))));
}

/** Logo oficial da Microsoft (4 quadrados), do kit. */
const logoMicrosoft = () => svg('svg', { class: 'ul-ms-logo', viewBox: '0 0 21 21', 'aria-hidden': 'true' },
  ['M0 0h10v10H0z', 'M11 0h10v10H11z', 'M0 11h10v10H0z', 'M11 11h10v10H11z']
    .map((d, i) => svg('path', { d, style: `fill: var(--microsoft-${i + 1})` })));

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

export function renderLogin(alvo, { precisaConfigurar, convite, microsoft, aviso, aoEntrar }) {
  const comMicrosoft = microsoft && !precisaConfigurar; // v35: Unità pela Microsoft; senha só para quem não tem 365
  const nome = h('input', { autocomplete: 'name', required: true });
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const senha = h('input', { type: 'password', autocomplete: precisaConfigurar ? 'new-password' : 'current-password', required: true });
  const botao = h('button', { class: comMicrosoft ? 'btn' : 'btn primary', type: 'submit', style: { width: '100%' } }, precisaConfigurar ? 'Criar acesso Dev' : (comMicrosoft ? 'Entrar com senha' : 'Entrar'));

  const form = formulario(botao, async () => {
    const r = precisaConfigurar
      ? await api.post('/auth/configurar', { nome: nome.value, email: email.value, senha: senha.value })
      : await api.post('/auth/login', { email: email.value, senha: senha.value });
    aoEntrar(r.usuario);
  },
  precisaConfigurar ? alerta('info', 'Primeiro acesso', 'Crie o usuário Dev, que depois cadastra os demais.') : null,
  aviso && !comMicrosoft ? alerta('warning', aviso) : null,
  precisaConfigurar ? campo('Nome', nome) : null,
  campo('E-mail', email),
  campo('Senha', senha, precisaConfigurar ? 'Mínimo de 8 caracteres' : null));
  if (convite && !precisaConfigurar) {
    form.append(h('button', { class: 'btn ghost sm', type: 'button', onclick: () => renderEsqueci(alvo, { email: email.value, voltar: () => renderLogin(alvo, { precisaConfigurar, convite, microsoft, aoEntrar }) }) }, 'Esqueci minha senha'));
  }
  if (!comMicrosoft) {
    telaAcesso(alvo, form, { subtitulo: precisaConfigurar ? 'Configure o primeiro acesso ao app.' : 'Entre com o seu e-mail e senha.' });
    (precisaConfigurar ? nome : email).focus();
    return;
  }
  // Clientes: o formulário de e-mail e senha só aparece depois do botão "Cliente".
  form.prepend(h('p', { class: 'muted', style: { margin: 0 } }, 'Acesso de clientes: e-mail e senha do app.'));
  form.style.display = 'none';
  const botaoCliente = h('button', { class: 'ul-botao ul-botao-secundario', type: 'button', onclick: () => {
    botaoCliente.style.display = 'none';
    form.style.display = '';
    email.focus();
  } }, 'Cliente');
  telaAcesso(alvo, h('div', { class: 'stack' },
    aviso ? alerta('warning', aviso) : null,
    blocoMicrosoft(aoEntrar),
    h('div', { class: 'ul-separador' }, 'ou'),
    botaoCliente,
    form), { subtitulo: 'Entre com a sua conta corporativa para acessar a apresentação.' });
}

/** v35 — "Entrar com a conta Microsoft": navega na aba própria; no iframe do portal, espera o pop-up. */
function blocoMicrosoft(aoEntrar) {
  const mensagem = h('div');
  let cancelado = false;
  const botao = h('button', { class: 'ul-botao', type: 'button', onclick: async () => {
    cancelado = false;
    botao.disabled = true;
    montar(mensagem, dentroDeIframe()
      ? h('div', { class: 'stack' },
        alerta('info', 'Conclua o login na janela da Microsoft', 'Depois de entrar, a janela fecha e o app abre aqui.'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { cancelado = true; montar(mensagem); botao.disabled = false; } }, 'Cancelar'))
      : null);
    try {
      const usuario = await entrarComMicrosoft({ cancelado: () => cancelado });
      if (usuario) return aoEntrar(usuario);
    } catch (e) {
      montar(mensagem, alerta('error', e.message));
    }
    botao.disabled = false;
  } }, logoMicrosoft(), 'Entrar com a conta Microsoft');
  return h('div', { class: 'stack' },
    mensagem,
    botao,
    h('p', { class: 'ul-nota' }, 'Equipe Unità: use a sua conta do Office 365.'));
}

/**
 * v35 — Pop-up do login Microsoft aberto pelo iframe do Portal Unità.
 * `popup`: recebe o pedido do iframe e segue para a Microsoft. `fim`: volta da Microsoft (o iframe já entra sozinho).
 */
export function renderPopupMicrosoft(alvo, { modo, erro }) {
  const fechar = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => window.close() }, 'Fechar esta janela');
  if (modo === 'fim') {
    telaAcesso(alvo, h('div', { class: 'stack' },
      erro ? alerta('error', 'Não foi possível entrar', erro) : alerta('success', 'Login concluído', 'O app já está abrindo no portal. Esta janela vai fechar.'),
      fechar), { titulo: 'Login Microsoft', subtitulo: null });
    if (!erro) setTimeout(() => window.close(), 1200);
    return;
  }
  const corpo = h('div', { class: 'stack' }, alerta('info', 'Abrindo o login da Microsoft…'));
  telaAcesso(alvo, corpo, { titulo: 'Login Microsoft', subtitulo: null });
  prepararPopup()
    .then((url) => { location.href = url; })
    .catch((e) => montar(corpo, alerta('error', 'Não foi possível abrir o login', e.message), fechar));
}

/** v35 — Lê (e apaga do endereço) os parâmetros do retorno do login Microsoft: `?login-microsoft=` e `?erro-login=`. */
export function retornoMicrosoft() {
  const params = new URLSearchParams(location.search);
  const modo = params.get('login-microsoft');
  const erro = params.get('erro-login');
  if (!modo && !erro) return null;
  if (modo !== 'popup') history.replaceState(null, '', location.pathname + location.hash);
  return { modo, erro };
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
  telaAcesso(alvo, form, { titulo: 'Nova senha', subtitulo: null });
  email.focus();
}

/** Volta do link do e-mail: a pessoa cria a senha e já entra. */
export function renderDefinirSenha(alvo, { token, hash, tipo, aoEntrar }) {
  const senha = h('input', { type: 'password', autocomplete: 'new-password', required: true });
  const repetir = h('input', { type: 'password', autocomplete: 'new-password', required: true });
  const botao = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%' } }, 'Salvar senha e entrar');
  telaAcesso(alvo, formulario(botao, async () => {
    if (senha.value !== repetir.value) throw new Error('As senhas não conferem.');
    const r = await api.post('/auth/definir-senha', hash ? { tokenHash: token, tipo, senha: senha.value } : { token, senha: senha.value });
    aoEntrar(r.usuario);
  },
  alerta('info', tipo === 'invite' ? 'Bem-vindo(a)!' : 'Nova senha', tipo === 'invite' ? 'Crie a sua senha para acessar o app.' : 'Crie uma nova senha para continuar.'),
  campo('Nova senha', senha, 'Mínimo de 8 caracteres'),
  campo('Repita a senha', repetir)), { subtitulo: null });
  senha.focus();
}
