/**
 * Cookie de sessão `sessao` (HttpOnly, SameSite=Strict). O conteúdo assinado é montado em autenticacao.mjs.
 */
export const NOME_COOKIE = 'sessao';
const DURACAO_S = 12 * 60 * 60;

export function lerCookie(req, nome) {
  for (const parte of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function cookieSessao(valor, { seguro }) {
  const attrs = [`${NOME_COOKIE}=${encodeURIComponent(valor)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${DURACAO_S}`];
  if (seguro) attrs.push('Secure');
  return attrs.join('; ');
}

export const cookieExpirado = () => `${NOME_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
