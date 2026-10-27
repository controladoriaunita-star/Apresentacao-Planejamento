# Contrato REST — Apresentação Planejamento

Base: `/api` (configurável no front em `<meta name="api-base">`). Respostas em JSON (UTF-8).
Erro: status HTTP + `{ "erro": "mensagem para o usuário" }`.

Este contrato é o mesmo nos dois armazenamentos (`STORE=local` e `STORE=supabase`) e é o que uma versão PHP
precisa reproduzir. Os cenários obrigatórios estão em `tests/api/contrato.mjs`, executados nos dois modos.

## Regras gerais

| Regra | Detalhe |
|---|---|
| Sessão | Cookie `sessao` = `base64url(JSON {u, exp}) + "." + HMAC-SHA256(segredo)`. HttpOnly, SameSite=Strict, 12 h. |
| CSRF | Todo método ≠ GET exige o cabeçalho `X-Requested-With: fetch`; sem ele → 403. |
| Permissão | 401 sem sessão; 403 se o papel não tem a capacidade. Papel relido do cadastro a cada requisição. |
| Papéis | `dev` (ver, editarConteudo, administrar) · `planejamento` (ver, editarConteudo) · `viewer` (ver). |
| Senhas | Supabase: no Supabase Auth. Local: PBKDF2-SHA256, 210.000 iterações (`pbkdf2$<iter>$<sal b64>$<hash b64>`). |
| Cookie (Supabase) | Além do id, guarda os tokens do Supabase Auth; a API renova o token vencido e devolve um cookie novo. |
| Compressão | JSON > 2 KB sai com gzip se o cliente aceitar. |

## Autenticação

| Método | Caminho | Permissão | Corpo → Resposta |
|---|---|---|---|
| GET | `/auth/sessao` | pública | → `{ usuario \| null, precisaConfigurar }` |
| POST | `/auth/login` | pública | `{ email, senha }` → `{ usuario }` + cookie. 401 se errado; 429 após 8 tentativas/min por IP |
| POST | `/auth/logout` | pública | → `{ ok }` e expira o cookie |
| POST | `/auth/configurar` | pública, só sem usuários | `{ nome, email, senha }` → 201 `{ usuario }` (papel dev). 409 se já configurado |
| PUT | `/auth/senha` | ver | `{ senhaAtual, novaSenha }` → `{ ok }` |

`usuario` = `{ id, nome, email, papel, ativo, criadoEm, ultimoAcesso? }` (nunca o hash).

## Usuários (administrar)

| Método | Caminho | Corpo → Resposta |
|---|---|---|
| GET | `/usuarios` | → `usuario[]` |
| POST | `/usuarios` | `{ nome, email, papel, senha }` → 201 `usuario`. 409 e-mail repetido; 400 validação |
| PUT | `/usuarios/:id` | `{ nome?, papel?, ativo?, senha? }` → `usuario`. 400 se o Dev tentar se desativar/rebaixar |
| DELETE | `/usuarios/:id` | → `{ ok }`. 400 para o próprio usuário |

## Dados das apresentações

| Método | Caminho | Permissão | Resposta |
|---|---|---|---|
| GET | `/dados/resumo` | ver | `{ fonte, aviso, atualizadoEm, abas: { "BD_Infos Gerais", "BD_Orc", "BD_Econômico" }, cadastro[], incc[] }` |
| GET | `/dados/fisico?obra=<nome>` | ver | `{ colunas, linhas }` do BD_Físico por atividade só da obra (nome comparado sem acento/caixa) |
| POST | `/dados/atualizar` | editarConteudo | relê as 4 abas no SharePoint → `{ ok, ...mesmo corpo de /dados/resumo }` (já relido na mesma instância) |
| GET | `/saude` | pública | `{ ok, fonte }` |

Cada aba é a matriz crua do Graph: `{ colunas: string[], linhas: unknown[][] }` (datas como serial do Excel).
**O servidor não calcula medidas** — os cálculos estão em `public/js/domain` e rodam no navegador.

`aviso`: preenchido quando o SharePoint falhou e o servidor devolveu o último cache gravado.

### Leitura no SharePoint (Microsoft Graph, app-only)

```
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token   (client_credentials, scope .default)
GET  https://graph.microsoft.com/v1.0/drives/{drive}/items/{item}/workbook/worksheets('{aba}')/usedRange(valuesOnly=true)?$select=values
```
Cache por aba de `CACHE_MINUTOS` (memória + `DATA_DIR/cache/*.json`).

## INCC

| Método | Caminho | Permissão | Corpo → Resposta |
|---|---|---|---|
| GET | `/incc` | ver | → `{ atualizadoEm, itens: [{ mes: "AAAA-MM", indice, origem, variacao? }] }` |
| POST | `/incc/atualizar` | editarConteudo | busca meses novos no BCB → `{ novos, atualizadoEm, itens }`; 502 se o BCB falhar |
| PUT | `/incc/:mes` | editarConteudo | `{ indice }` → série atualizada (manual prevalece) |

Fonte online: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.192/dados?formato=json&dataInicial=01/MM/AAAA`
(variação % mensal do INCC-DI). Índice do mês = índice anterior × (1 + variação/100).

## Cadastro de obras

| Método | Caminho | Permissão | Corpo → Resposta |
|---|---|---|---|
| GET | `/obras/cadastro` | ver | → `cadastro[]` |
| PUT | `/obras/cadastro` | editarConteudo | campos de `public/js/domain/cadastro-obra.js` → cadastro salvo (um por obra; atualiza pela `chave`) |
| POST | `/obras/cadastro/importar` | editarConteudo | `{ linhas: [ { "<cabeçalho do Painel de Obras>": valor } ] }` → `{ importados, obras }` |
| DELETE | `/obras/cadastro/:id` | editarConteudo | → `{ ok }` |

## Arquivos, mídias (TxC/fotos) e telas extras

| Método | Caminho | Permissão | Corpo → Resposta |
|---|---|---|---|
| POST | `/arquivos/envio` | editarConteudo | `{ nome, tipo, tamanho }` → `{ arquivo, envio: { modo, url, metodo, cabecalhos } }`. **modo `direto`** (Supabase): o navegador faz `PUT` do arquivo em `url` e usa `arquivo.id`. **modo `servidor`** (local): enviar para `POST /arquivos`. 415/413 como abaixo |
| POST | `/arquivos` | editarConteudo | **corpo binário** (`Content-Type` do arquivo, `X-Nome-Arquivo` URL-encoded) → 201 `{ id, nome, tipo, categoria, tamanho }`. 415 tipo não aceito; 413 acima de `UPLOAD_LIMITE_MB` |
| GET | `/arquivos/:id` | ver | bytes do arquivo (local) ou **302** para URL assinada de leitura (Supabase) |
| DELETE | `/arquivos/:id` | editarConteudo | descarta um arquivo (ex.: envio direto que falhou) |
| GET | `/midias?tipo=&chaveObra=&mes=` | ver | → `midia[]` (mês decrescente) |
| POST | `/midias` | editarConteudo | `{ tipo: "txc"\|"foto", obra, mes: "AAAA-MM", grupo?, comentario?, arquivoId, destino?, ordem? }` → 201. `destino`: `"ambas"` (padrão) \| `"obra"` \| `"cliente"`; `visivelCliente` (antigo) ainda é aceito e é devolvido derivado do destino |
| PUT | `/midias/:id` | editarConteudo | campos parciais → mídia (arquivo trocado é apagado) |
| DELETE | `/midias/:id` | editarConteudo | apaga a mídia e o arquivo |
| GET | `/telas` | ver | → `tela[]` por ordem |
| POST/PUT | `/telas`, `/telas/:id` | editarConteudo | `{ titulo, subtitulo?, destino: "obra"\|"cliente"\|"ambas" (padrão "cliente"), obras: [nome\|chave], ordem, ativa, blocos: [{ tipo: "imagem"\|"planilha"\|"texto", titulo?, arquivoId?, aba?, texto?, largura: "inteira"\|"metade" }] }` |
| DELETE | `/telas/:id` | editarConteudo | apaga a tela e seus arquivos |

Tipos aceitos no upload: PNG, JPEG, WEBP, GIF, PDF, CSV, XLS, XLSX, XLSM.
