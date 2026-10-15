# Apresentação Planejamento — Unità

Apresentações **Obra** e **Cliente** que substituem o Power BI *One Page - Planejamento e Controle*. Obras e curvas
vêm das planilhas do SharePoint (Microsoft Graph); usuários, cadastros e anexos ficam no **Supabase**; publicação
na **Vercel** (`docs/SUPABASE_VERCEL.md`). Front em HTML/CSS/JS puro (sem build) no padrão visual Unità v1.0;
servidor fino em Node com contrato REST também portável para PHP.

## Rodar

```bash
npm install
npm start            # dados reais (SharePoint) em http://localhost:5210 — credenciais em .env.local
                     # STORE=local (padrão) guarda usuários/anexos em data/; STORE=supabase usa o Supabase
npm run exemplo      # demonstração com dados fictícios em http://localhost:5211
```

No primeiro acesso o app pede para criar o usuário **Dev**; ele cadastra os demais em Administração → Usuários.

## Papéis

| Papel | Pode |
|---|---|
| Dev | tudo, inclusive usuários e diagnóstico das fontes |
| Planejamento | cadastrar fotos, TxC, telas do cliente, cadastro de obras; atualizar dados |
| Viewer | só visualizar as apresentações |

## Abas

Início · Resumo Geral · Resumo Físico · Resumo Econômico · Tempo x Caminho · Acompanhamento Fotográfico.
A apresentação Cliente tem as mesmas abas com as colunas "- Cliente" e mais as **telas do cliente** (planilhas
somente leitura, imagens e textos montados pelo Planejamento). Botão **Apresentar** = tela cheia sem filtros.

## Estrutura

```
public/                 front (servido como estático; igual no Node e no PHP)
  css/tokens.css        única fonte de cores/tipografia (identidade Unità)
  js/domain/            cálculos puros (medidas do Power BI) — testados
  js/core, js/ui, js/pages
server/                 API Node sem framework (local ou Supabase; PHP: docs/MIGRACAO_PHP.md)
api/index.mjs           função única da Vercel (usa o mesmo server/app.mjs)
supabase/migrations/    SQL do banco (tabelas, RLS, bucket)
tests/                  domínio, contrato da API e testes de tela (Playwright + Edge)
docs/                   API.md, CALCULOS.md, MIGRACAO_PHP.md, ESTUDO_TXC.md
data/                   (fora do git) usuários, cadastros, arquivos enviados, cache
```

## Versões e testes de regressão

Toda alteração fecha uma versão (`v01`, `v02`…) registrada no `CHANGELOG.md` e só é liberada se passar:

```bash
npm run verificar    # checagens (sintaxe, cores fora dos tokens, segredos) + 55 testes + 15 testes de tela
```

Bug corrigido ganha um teste que o reproduz. Os testes de tela ficam em `.cjs` porque o carregador ESM do
Playwright trava com acentos no caminho da pasta no Windows.
