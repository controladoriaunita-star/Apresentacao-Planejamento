# Implantação — Supabase + Vercel

| Onde | O que fica |
|---|---|
| **SharePoint** (Microsoft Graph) | Obras e curvas: `BD_Infos Gerais`, `BD_Físico por atividade`, `BD_Orc`, `BD_Econômico` — só leitura |
| **Supabase Auth** | Login, senhas e criação de usuários |
| **Supabase (Postgres)** | `perfis` (papel de cada usuário), `cadastro_obras`, `arquivos`, `midias` (TxC/fotos), `telas` |
| **Supabase Storage** (bucket privado `apresentacao`) | Anexos (`anexos/<id>`) e documentos do sistema (`sistema/…`: cache das planilhas e INCC) |
| **Vercel** | Front (`public/`, estático) e a API (`api/index.mjs`, função única) |

O navegador nunca acessa o Supabase com chave: tudo passa pela API, que usa a service role só no servidor.
Os anexos vão do navegador direto ao Storage por URL assinada (curta, gerada pela API), o que evita o
limite de 4,5 MB por requisição da Vercel.

## 1. Criar o projeto no Supabase

1. Crie um projeto **novo, só deste app** (região São Paulo, se disponível).
2. **SQL Editor** → cole e rode, em ordem, os arquivos de `supabase/migrations/` (`001_apresentacao.sql`,
   `002_destino_telas_midias.sql`…). Podem rodar de novo sem problema.
3. **Authentication → Providers → Email**: deixe "Email" ligado. Desligue **"Allow new users to sign up"** — os
   usuários são convidados só pelo Dev, dentro do app.
4. **Project Settings → API**: copie *Project URL*, a chave **anon/publishable** e a **service_role/secret**.
5. **E-mails de convite e de nova senha** (ver [Login e convites](#login-e-convites)):
   - **Authentication → Emails → SMTP Settings**: ligue o SMTP próprio (ex.: uma caixa do Microsoft 365 da Unità,
     `smtp.office365.com`, porta 587). Sem isso o Supabase só envia para os membros do projeto, poucas mensagens
     por hora.
   - **Authentication → URL Configuration**: *Site URL* = endereço de produção do app. Em *Redirect URLs*, adicione
     o de produção (`https://<app>.vercel.app/**`) e o das prévias da Vercel do time
     (`https://*-<time>.vercel.app/**`). Não use `https://*.vercel.app/**`: qualquer pessoa publica nesse domínio.
   - (Opcional) **Authentication → Emails → Templates**: textos em português para *Invite user* e *Reset password*.

## 2. Testar no computador antes de publicar

No `.env.local` (fica fora do git):

```
STORE=supabase
SUPABASE_URL=https://<projeto>.supabase.co
SUPABASE_ANON_KEY=<anon / publishable>
SUPABASE_SERVICE_ROLE_KEY=<service_role / secret>
```

Rode `npm start` e abra `http://localhost:5210`: como o banco está vazio, aparece o **primeiro acesso** para criar o
usuário Dev (ele é criado no Supabase Auth).

### Levar o que já foi cadastrado no modo local

Se já existem obras, imagens, telas ou usuários cadastrados em `data/`:

```powershell
$env:MIGRACAO_SENHA_TEMPORARIA="uma-senha-forte-temporaria"
npm run migrar:supabase
```

Copia cadastro de obras, anexos (com os arquivos), TxC/fotos, telas, INCC e usuários. As senhas antigas não migram
(o Supabase não aceita o formato): cada usuário entra com a senha temporária e troca em "Minha conta".
Rode a migração **antes** do primeiro acesso (com o banco vazio), senão o Dev criado no primeiro acesso e o Dev
migrado ficam duplicados por e-mail — o script pula e-mails que já existem.

## 3. Publicar na Vercel

1. Suba o projeto para um repositório no GitHub (a pasta `data/`, o `.env.local` e os arquivos de referência
   `.pbix/.xlsx` já estão no `.gitignore`).
2. Na Vercel: **Add New → Project** → escolha o repositório. Framework: **Other**. O `vercel.json` já define:
   build `npm run verificar:vercel` (checagens + testes), saída `public/` e a função `api/index.mjs` (60 s).
3. **Settings → Environment Variables** (Production e Preview):

| Variável | Valor |
|---|---|
| `STORE` | `supabase` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | do passo 1 |
| `SESSION_SECRET` | texto aleatório longo (trocar encerra todas as sessões) |
| `DOMINIO_EMAIL` | opcional; padrão `unitaengenharia.com.br` (só esses e-mails entram) |
| `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET` | mesmos do `.env.local` |
| `MS_GRAPH_DRIVE_ID`, `MS_GRAPH_ITEM_ID` | os da planilha (ver `.env.example`) |

4. **Deploy**. Na Vercel o cookie sai com `SameSite=None; Secure; Partitioned`, o que permite o login dentro do
   iframe do Portal Unità.

## Login e convites

- **Novo colaborador**: o Dev abre *Administração → Usuários → Novo usuário* e informa nome, e-mail
  `@unitaengenharia.com.br` e papel (padrão Viewer). O Supabase envia o convite; o link abre o app numa tela para a
  pessoa criar a senha, e ela já entra. *Editar → Reenviar e-mail de acesso* manda o link de novo (ou o de nova
  senha, para quem já entrou).
- **Esqueci minha senha**: na tela de login; chega um link para criar uma nova senha.
- **Dentro do Portal Unità (iframe)**: o login é separado do da aba aberta direto no app (cookie particionado por
  site). O convite e o "esqueci minha senha" abrem numa aba própria; depois a pessoa entra no portal com e-mail e
  senha. Safari bloqueia cookies dentro de iframes de outro site: lá, abrir o app numa aba.
- **Papéis**: Dev (tudo, inclusive usuários), Planejamento (conteúdo) e Viewer (só vê). Mudar papel ou desativar
  vale na hora.

## Como funciona por dentro

- **Login**: `POST /api/auth/login` → a API faz o login no Supabase Auth e guarda os tokens num cookie
  `HttpOnly` assinado (o JavaScript da página não lê tokens). Quando o token vence, a API renova sozinha.
- **Papel**: lido da tabela `perfis` a cada requisição — mudar papel ou desativar vale na hora. Desativar também
  bloqueia o usuário no Supabase Auth.
- **Anexo**: `POST /api/arquivos/envio` cria o registro e uma URL assinada de envio → o navegador faz `PUT` direto
  no Storage. Para exibir, `GET /api/arquivos/:id` redireciona para uma URL assinada de leitura (1 h).
- **Planilhas**: cada instância da Vercel guarda as abas em memória por `CACHE_MINUTOS`; a última leitura também
  fica no Storage (`sistema/cache/…`), então uma instância nova começa por ela em vez de esperar o SharePoint
  (a aba de atividades leva ~10 s).

## Desenvolvimento e testes continuam sem Supabase

`STORE=local` (padrão) guarda tudo em `data/`. A suíte de contrato roda nos dois modos — no Supabase, contra um
simulador em memória (`tests/api/supabase-falso.mjs`) — então `npm run verificar` não precisa de internet.
