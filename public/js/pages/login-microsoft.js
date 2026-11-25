/**
 * v35 — Login com a conta Microsoft no navegador (o fluxo OpenID roda no servidor: server/auth/microsoft.mjs).
 *
 * - Aba própria: navegação de página inteira para /api/auth/microsoft/entrar (não é fetch, senão o redirect não
 *   acontece).
 * - Dentro do iframe do Portal Unità: a Microsoft não abre em iframe. O iframe abre um pop-up do próprio app
 *   (`?login-microsoft=popup`), sorteia um verificador e entrega ao pop-up só o hash dele (o `pedido`), por
 *   postMessage nos dois sentidos com a origem conferida. O pop-up segue para a Microsoft; o iframe pergunta ao
 *   servidor, com o verificador, se o login terminou (/auth/microsoft/concluir) e recebe ali o cookie de sessão.
 */
import { api, BASE_API } from '../core/api.js';

const PRONTO = 'login-microsoft:pronto';
const PEDIDO = 'login-microsoft:pedido';
const INTERVALO_MS = 2000;
const LIMITE_MS = 10 * 60 * 1000;

export function dentroDeIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sha256Hex(texto) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
  return [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Clique em "Entrar com a conta Microsoft". Na aba própria só navega. No iframe abre o pop-up e espera o resultado:
 * resolve com o usuário, rejeita com a mensagem de erro, ou resolve null se `cancelado()` ficar verdadeiro.
 */
export async function entrarComMicrosoft({ cancelado = () => false } = {}) {
  if (!dentroDeIframe()) {
    location.href = `${BASE_API}/auth/microsoft/entrar`;
    return new Promise(() => {}); // a página vai embora
  }
  // O pop-up precisa abrir ainda dentro do clique (antes de qualquer await), senão o navegador bloqueia.
  const popup = window.open(`${location.pathname}?login-microsoft=popup`, 'login-microsoft', 'popup,width=520,height=680');
  if (!popup) throw new Error('O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo.');

  const verificador = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const pedido = sha256Hex(verificador);
  const aoReceber = async (e) => {
    if (e.origin !== location.origin || e.source !== popup || e.data?.tipo !== PRONTO) return;
    popup.postMessage({ tipo: PEDIDO, pedido: await pedido }, location.origin);
  };
  window.addEventListener('message', aoReceber);
  try {
    const limite = Date.now() + LIMITE_MS;
    while (Date.now() < limite) {
      await esperar(INTERVALO_MS);
      if (cancelado()) return null;
      const r = await api.post('/auth/microsoft/concluir', { verificador });
      if (!r?.pendente) return r.usuario;
    }
    throw new Error('O login não foi concluído a tempo. Tente de novo.');
  } finally {
    window.removeEventListener('message', aoReceber);
  }
}

/**
 * Pop-up aberto pelo iframe: avisa o iframe que está pronto, recebe o pedido (só do próprio app que o abriu) e segue
 * para a Microsoft. Resolve com o endereço de destino; rejeita se não conseguir falar com o app.
 */
export function prepararPopup() {
  return new Promise((resolve, reject) => {
    const origem = window.opener;
    if (!origem) return reject(new Error('Abra o login pelo botão "Entrar com a conta Microsoft" do app.'));
    let aviso = 0;
    let limite = 0;
    const encerrar = () => {
      clearInterval(aviso);
      clearTimeout(limite);
      window.removeEventListener('message', aoReceber);
    };
    const aoReceber = async (e) => {
      if (e.origin !== location.origin || e.source !== origem || e.data?.tipo !== PEDIDO) return;
      encerrar();
      try {
        const { url } = await api.post('/auth/microsoft/preparar', { pedido: e.data.pedido });
        resolve(url);
      } catch (err) {
        reject(err);
      }
    };
    window.addEventListener('message', aoReceber);
    const avisar = () => {
      try {
        origem.postMessage({ tipo: PRONTO }, location.origin); // só chega se quem abriu é o próprio app
      } catch { /* janela de origem fechada */ }
    };
    avisar();
    aviso = setInterval(avisar, 500);
    limite = setTimeout(() => {
      encerrar();
      reject(new Error('Não foi possível falar com o app no portal. Feche esta janela e tente de novo.'));
    }, 10_000);
  });
}
