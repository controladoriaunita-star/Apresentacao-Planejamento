# Contrato REST — Apresentação Planejamento

Base: `/api` (configurável no front em `<meta name="api-base">`). Respostas em JSON (UTF-8).
Erro: status HTTP + `{ "erro": "mensagem para o usuário" }`.

Este contrato é o mesmo nos dois armazenamentos (`STORE=local` e `STORE=supabase`) e é o que uma versão PHP
precisa reproduzir. Os cenários obrigatórios estão em `tests/api/contrato.mjs`, executados nos dois modos.

## Regras gerais

| Regra | Detalhe |
|---|---|
| Sessão | Cookie `sessao` = `base64url(JSON {u, exp}) + "." + HMAC-SHA256(segredo)`. HttpOnly, 12 h. Em HTTPS `SameSite=None; Secure; Partitioned` (o app abre no iframe do Portal Unità); em http, `SameSite=Lax`. |
| Domínio | Só e-mails `@DOMINIO_EMAIL` (padrão `unitaengenharia.com.br`) no primeiro acesso e na criação de usuários; outro → 400. |
| CSRF | Todo método ≠ GET exige o cabeçalho `X-Requested-With: fetch`; sem ele → 403. |
| Permissão | 401 sem sessão; 403 se o papel não tem a capacidade. Papel relido do cadastro a cada requisição. |
| Papéis | `dev` (tudo) · `planejamento` (ver, verSeguranca, editarSeguranca, editarConteudo) · `seguranca` (verSeguranca, editarSeguranca) · `viewer` (ver, verSeguranca). Todos têm `conta`. |
| Senhas | Supabase: no Supabase Auth. Local: PBKDF2-SHA256, 210.000 iterações (`pbkdf2$<iter>$<sal b64>$<hash b64>`). |
| Cookie (Supabase) | Além do id, guarda os tokens do Supabase Auth; a API renova o token vencido e devolve um cookie novo. |
| Compressão | JSON > 2 KB sai com gzip se o cliente aceitar. |

## Autenticação

| Método | Caminho | Permissão | Corpo → Resposta |
|---|---|---|---|
| GET | `/auth/sessao` | pública | → `{ usuario \| null, precisaConfigurar, convite }` (`convite`: novos usuários entram por e-mail — Supabase) |
| POST | `/auth/login` | pública | `{ email, senha }` → `{ usuario }` + cookie. 401 se errado; 429 após 8 tentativas/min por IP |
| POST | `/auth/logout` | pública | → `{ ok }` e expira o cookie |
| POST | `/auth/configurar` | pública, só sem usuários | `{ nome, email, senha }` → 201 `{ usuario }` (papel dev). 409 se já configurado |
| PUT | `/auth/senha` | conta | `{ senhaAtual, novaSenha }` → `{ ok }` |
| POST | `/auth/recuperar` | pública | `{ email }` → `{ ok }` (igual exista ou não o e-mail; envia o link de nova senha). Local: 400. Conta no limite de 8/min |
| POST | `/auth/definir-senha` | pública | `{ token, senha }` → `{ usuario }` + cookie. `token` = `access_token` que o link do e-mail traz no endereço (`#access_token=…&type=invite\|recovery`). 400 token inválido/vencido; 403 usuário inativo. Local: 400 |

`usuario` = `{ id, nome, email, papel, ativo, criadoEm, ultimoAcesso? }` (nunca o hash).

## Usuários (administrar)

| Método | Caminho | Corpo → Resposta |
|---|---|---|
| GET | `/usuarios` | → `usuario[]` |
| POST | `/usuarios` | `{ nome, email, papel, senha }` → 201 `usuario`. 409 e-mail repetido; 400 validação. Supabase: sem `senha` — envia o convite por e-mail |
| POST | `/usuarios/:id/acesso` | → `{ ok }`. Reenvia o convite (ou o link de nova senha, se o e-mail já foi confirmado). Local: 400 |
| PUT | `/usuarios/:id` | `{ nome?, papel?, ativo?, senha? }` → `usuario`. 400 se o Dev tentar se desativar/rebaixar |
| DELETE | `/usuarios/:id` | → `{ ok }`. 400 para o próprio usuário |

## Dados das apresentações

| Método | Caminho | Permissão | Resposta |
|---|---|---|---|
| GET | `/dados/resumo` | ver | `{ fonte, aviso, atualizadoEm, abas: { "BD_Infos Gerais", "BD_Orc", "BD_Econômico" }, cadastro[], incc[], layoutResumoGeral }` — `layoutResumoGeral` = layout salvo pelo Dev ou `null` (padrão do app) (v24) |
| GET | `/dados/fisico?obra=<nome>` | ver | `{ colunas, linhas }` do BD_Físico por atividade só da obra (nome comparado sem acento/caixa) |
| POST | `/dados/atualizar` | editarConteudo | relê as 4 abas no SharePoint → `{ ok, ...mesmo corpo de /dados/resumo }` (já relido na mesma instância) |
| GET | `/saude` | pública | `{ ok, fonte }` |
| PUT | `/layouts/resumo-geral` | administrar | `{ layout: { <quadro>: { x, y, w, h } } }` → `{ layout }`. Grade de 24 × 24 (`public/js/domain/layout-resumo.js`): valores ajustados aos limites, quadros sobrepostos → 400. Gravado no armazém de documentos (`DATA_DIR/layout-resumo-geral.json` ou Storage `sistema/` no Supabase), vale para todas as apresentações (v24) |

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
| DELETE | `/obras/cadastro/:id` | editarConteudo | → `{ ok }`. **409** se a obra tiver acidentes na Segurança do Trabalho (v22) |

## Arquivos, mídias (TxC/fotos) e telas extras

| Método | Caminho | Permissão | Corpo → Resposta |
|---|---|---|---|
| POST | `/arquivos/envio` | editarConteudo | `{ nome, tipo, tamanho }` → `{ arquivo, envio: { modo, url, metodo, cabecalhos } }`. **modo `direto`** (Supabase): o navegador faz `PUT` do arquivo em `url` e usa `arquivo.id`. **modo `servidor`** (local): enviar para `POST /arquivos`. 415/413 como abaixo |
| POST | `/arquivos` | editarConteudo | **corpo binário** (`Content-Type` do arquivo, `X-Nome-Arquivo` URL-encoded) → 201 `{ id, nome, tipo, categoria, tamanho }`. 415 tipo não aceito (imagens: PNG, JPG, WEBP, GIF — o front converte os demais formatos antes, v23); 413 acima de `UPLOAD_LIMITE_MB` |
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

## Segurança do Trabalho (v22)

Regras em `public/js/domain/seguranca.js`; detalhes em `docs/SEGURANCA_TRABALHO.md`. Acidente =
`{ id, obraId, data, faseObra, nomeAcidentado, funcao, empresa, tipo: "CPT"|"SPT"|"TRJ"|"FT", parteCorpo, diasAfastamento, resumo, origem, criadoPor, criadoEm, atualizadoPor, atualizadoEm }`.
Nas respostas vêm também `obra`, `chaveObra`, `incorporador` (= Cliente) e `metodoConstrutivo` (= Sistema estrutural), lidos do Cadastro de obras.

| Método | Caminho | Permissão | Corpo → Resposta |
|---|---|---|---|
| GET | `/seguranca/obras` | editarSeguranca | → `[{ id, chave, obra, cliente, sistemaEstrutural }]` — obras do cadastro para o papel Segurança, que não lê `/dados/resumo` (v23) |
| GET | `/seguranca/acidentes?obras=<ids>\|chaves=<chaves>&de=&ate=&tipos=CPT,SPT&nome=&empresa=&ordem=asc\|desc&pagina=1&tamanho=50` | verSeguranca | → `{ itens, total, pagina, tamanho }`. `tamanho` até 200; `tamanho=todos` (abas da apresentação) até 5000 |
| GET | `/seguranca/indicadores?obras=\|chaves=&anos=2025,2026` | verSeguranca | → `{ anosDisponiveis, anos, indicadores }` (`calcularIndicadores`) |
| POST | `/seguranca/acidentes` | editarSeguranca | campos do acidente → 201. 400 campo inválido/obra sem Cliente ou Sistema estrutural; **409** acidente já existe (`chaveDedup`) |
| PUT | `/seguranca/acidentes/:id` | editarSeguranca | campos parciais → acidente (mesmas validações; 409 se virar duplicado) |
| DELETE | `/seguranca/acidentes/:id` | editarSeguranca | → `{ ok }` |
| POST | `/seguranca/importacao/analisar` | editarSeguranca | `{ linhas: [ { "<cabeçalho>": valor, __linha } ], mapaObras?: { "<chave do nome>": "<id do cadastro>" } }` → `{ linhas: [{ linha, situacao: "novo"\|"existente"\|"repetido"\|"erro", erros, avisos, entrada, acidente }], totais, obrasNaoEncontradas }` — não grava |
| POST | `/seguranca/importacao` | editarSeguranca | mesmo corpo → reanalisa e grava só os `novo` num único comando → `{ importados, jaExistentes, repetidos, comErro, erros: [{ linha, erros }] }` |
