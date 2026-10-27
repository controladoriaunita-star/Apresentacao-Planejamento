/**
 * Cookie de sessão `sessao` (HttpOnly). O conteúdo assinado é montado em autenticacao.mjs.
 *
 * Em HTTPS (Vercel) sai com `SameSite=None; Secure; Partitioned`: o app abre dentro do iframe do Portal Unità,
 * que é outro site, e só assim o navegador envia o cookie lá dentro (Partitioned = cookie separado por site do
 * portal, aceito mesmo onde cookies de terceiros são bloqueados). As escritas continuam protegidas contra CSRF
 * pelo cabeçalho `x-requested-with` (app.mjs). Em http://localhost: `SameSite=Lax`.
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

const atributos = (seguro) => ['Path=/', 'HttpOnly', ...(seguro ? ['SameSite=None', 'Secure', 'Partitioned'] : ['SameSite=Lax'])];

export function cookieSessao(valor, { seguro }) {
  return [`${NOME_COOKIE}=${encodeURIComponent(valor)}`, ...atributos(seguro), `Max-Age=${DURACAO_S}`].join('; ');
}

/** Os atributos precisam ser os mesmos do cookie criado, senão o navegador não o apaga (Partitioned). */
export const cookieExpirado = ({ seguro }) => [`${NOME_COOKIE}=`, ...atributos(seguro), 'Max-Age=0'].join('; ');
