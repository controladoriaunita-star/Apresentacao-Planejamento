# Migração para PHP (Hostinger)

> Produção atual: **Vercel + Supabase** (`docs/SUPABASE_VERCEL.md`). Este guia continua válido para uma versão PHP:
> com `STORE=supabase`, o PHP só precisa chamar as mesmas URLs REST do Supabase (Auth, PostgREST, Storage) com cURL,
> como faz `server/supabase/cliente.mjs` — o banco e os arquivos ficam onde estão.

O projeto foi montado para que a troca Node → PHP mexa **só na pasta `server/`**.

## O que não muda

- `public/` inteiro (HTML, CSS, JS, vendor, marca): o Apache da Hostinger serve como arquivos estáticos.
  Não há etapa de build nem reescrita de URL (rotas por `#/…`).
- `public/js/domain/`: todos os cálculos (medidas do Power BI) rodam no navegador.
- O contrato REST (`docs/API.md`) e os formatos de dados (JSON em `DATA_DIR`).
- As variáveis de ambiente (`.env.example`).

## O que reescrever em PHP (≈ 600 linhas)

| Node (server/) | PHP sugerido | Observação |
|---|---|---|
| `config.mjs` | `api/config.php` | Lê as mesmas chaves (`.env` fora de `public_html`). |
| `http/roteador.mjs` + `app.mjs` | `api/index.php` | Um front controller; `.htaccess` em `api/` manda tudo para `index.php`. |
| `auth/senha.mjs` | `hash_pbkdf2('sha256', $senha, $sal, 210000, 32, true)` | Mesmo formato `pbkdf2$…`: usuários migram sem trocar senha. |
| `auth/sessao.mjs` | `hash_hmac('sha256', $corpo, $segredo)` + `base64url` | Mesmo cookie `sessao`. Use o mesmo `SESSION_SECRET`. |
| `store/json-store.mjs` | `file_get_contents` / `json_decode` / `flock` + `rename` | Mesmos arquivos `usuarios.json`, `midias.json`… |
| `store/arquivos.mjs` | `file_get_contents('php://input')` | Upload é corpo binário cru, não multipart. |
| `sources/graph.mjs` | `curl` (token + `usedRange`) | Guardar o token em `DATA_DIR/cache/token.json` até expirar. |
| `sources/planilhas.mjs` | idem, cache em arquivo | O `fisico?obra=` filtra pela coluna "Nome da Obra" sem acento/caixa. |
| `sources/incc.mjs` | `curl` no BCB | Mesmo `incc.json`. |
| `routes/*.mjs` | um arquivo por grupo | As validações de mídia/tela/cadastro estão em `public/js/domain/*.js` — portar as regras. |

`DATA_DIR` deve ficar **fora** de `public_html` (ex.: `/home/<usuario>/dados-apresentacao`).

## Estrutura sugerida na Hostinger

```
public_html/apresentacao/          ← conteúdo de public/
public_html/apresentacao/api/      ← index.php + .htaccess (RewriteRule ^ index.php)
/home/<usuario>/apresentacao-dados ← DATA_DIR (usuarios.json, arquivos/, cache/…)
/home/<usuario>/apresentacao.env   ← credenciais do Graph e SESSION_SECRET
```
No `index.html`, ajustar `<meta name="api-base" content="/apresentacao/api">`.

## Como validar a versão PHP

1. Copiar `DATA_DIR` do Node para o servidor PHP (usuários e conteúdo continuam valendo).
2. Rodar os testes de contrato apontando para o PHP: adaptar `tests/api/servidor.mjs` para usar a URL do PHP
   em vez de subir o Node (os cenários de `api.test.mjs` são os critérios de aceite).
3. Rodar os testes de tela (`npm run test:e2e`) com `baseURL` do PHP.

## Limites do armazenamento em JSON

Adequado para dezenas de usuários e milhares de imagens. Se crescer, trocar `ColecaoJson` por um repositório MySQL
(a Hostinger inclui MySQL) mantendo os mesmos métodos `listar/obter/inserir/atualizar/remover`.
