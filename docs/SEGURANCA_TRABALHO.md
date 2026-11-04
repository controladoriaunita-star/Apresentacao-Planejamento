# Segurança do Trabalho (v22) — notas técnicas e de integração

Módulo de acidentes por obra, feito como extensão do app (mesma stack: HTML/CSS/JS sem build, servidor Node fino,
Supabase só pela API com service role, Chart.js e SheetJS já em `public/vendor`). Nenhuma dependência nova.

## Referências usadas

| Arquivo | O que foi reproduzido |
|---|---|
| `Controle de Acidentes-Dashboard.xlsx` → aba **Dados** | Colunas do modelo de importação e listas de validação (Fase da Obra, Tipo) |
| → **Analise_Dinamicas** (Tab01…Tab10) | Fórmulas dos indicadores (todas "Contagem de Tipo", exceto Tab02 = média de Dias Afastamento) |
| → **Dashboard-01** | Total, Média de dias, Nº por período (Jan–Dez), Classificação, Fase, Nº por obra (10 primeiros), Por ano |
| → **Dashboard-02** | Função, Empresa contratada e Parte do corpo (10 primeiros) |
| `Modelo - Indicador Segurança do Trabalho.png` | Tabela por período (SPT/CPT/TRJ/FT mesclados por mês, DP, resumo) e gráfico de colunas mês a mês por tipo |

Conferência: lendo as 142 linhas reais da aba Dados com o mesmo código da importação, as contagens por tipo
(98/39/5), por fase (12/119/11) e por obra (10 primeiros + empates) batem com as tabelas dinâmicas.

## Banco (Supabase) — `supabase/migrations/003_seguranca_trabalho.sql`

- Tabela nova `acidentes`; nenhuma tabela existente foi alterada.
- `obra_id → cadastro_obras.id` (`on delete restrict`). **Incorporador e Método construtivo não são gravados no
  acidente**: a API junta Cliente e Sistema estrutural do Cadastro de obras a cada leitura (sem duplicidade nem
  divergência). Não foi guardado retrato histórico porque nada no pedido exige o valor da época; se o cadastro de
  uma obra mudar de cliente, os acidentes passam a mostrar o novo (avaliar com a Segurança se é o desejado).
- `chave_dedup` única — ver "Duplicidade".
- `check` para tipo, parte do corpo, fase e dias ≥ 0 (as mesmas listas de `domain/seguranca.js`).
- RLS ligado, sem políticas (como as demais tabelas): o navegador nunca acessa o banco.

## Duplicidade na planilha acumulativa

`chaveDedup = data | obraId | acidentado | tipo | parte do corpo | função | empresa` (textos sem acento/caixa/espaços extras).
Nunca só nome ou data. Dias de afastamento e resumo ficam fora da chave de propósito: são corrigidos com o tempo
(afastamento prorrogado) e isso não pode criar outro acidente — a pré-visualização avisa quando os dias diferem do
registro já gravado (o gravado é mantido; para corrigir, editar o acidente).

## Importação

1. O navegador lê a planilha (aba "Dados" ou a primeira) com SheetJS, como já fazia o Cadastro de obras.
2. `POST /api/seguranca/importacao/analisar` valida cada linha com as mesmas regras do formulário e devolve
   novo / já cadastrado / repetido na planilha / erro, com mensagens por linha. Nada é gravado.
3. Obras com nome diferente do cadastro: de-para na tela (vale para todas as linhas daquele nome).
4. `POST /api/seguranca/importacao` reanalisa no servidor (não confia no navegador) e grava só os novos válidos num
   único comando (no Supabase, inserção em lote com `on_conflict=chave_dedup` + `ignore-duplicates`). Linhas com erro
   não afetam nada já gravado.

## Telas e filtros

| Tela | Rota | Filtro |
|---|---|---|
| Administração → Segurança do Trabalho | `#/admin/seguranca` | próprios (obras, período, tipo, pesquisa), paginação no servidor (50/página) |
| Dashboard Segurança (sub-aba de Administração → Segurança do Trabalho) | `#/admin/seguranca-dashboard` | Obras do Cadastro de obras (padrão: todas) e segmentador Ano. Um indicador por vez (botões), ocupando o resto da tela |
| Segurança do Trabalho | `#/obra/seguranca-trabalho`, `#/cliente/seguranca-trabalho` | Tela cheia (Apresentar): sempre a obra do filtro geral. Fora: seletor "Obra exibida" (filtro geral, todas ou uma obra) |

Período do gráfico mês a mês (`mesesDoGrafico`): de 1 mês antes do primeiro acidente até 1 mês depois do último,
com todos os meses do meio; no mínimo 12 meses (completa para trás); sem acidentes, os 12 meses até o mês de
referência. O mês de referência aparece na tabela mesmo sem acidente. O quadro do gráfico vai até o pé da tela.

## Arquivos

Criados:
- `public/js/domain/seguranca.js` — regras, deduplicação, importação, indicadores
- `public/js/pages/admin-seguranca.js`, `public/js/pages/dashboard-seguranca.js`, `public/js/pages/seguranca-trabalho.js`
- `server/routes/seguranca.mjs`, `server/store/acidentes.mjs`
- `supabase/migrations/003_seguranca_trabalho.sql`
- `tests/domain/seguranca.test.mjs`, `tests/api/seguranca.test.mjs`, este documento

Alterados (só acréscimos, sem mudar o comportamento anterior):
- `public/js/main.js` — aba Segurança do Trabalho, seção de administração e a sub-aba Dashboard Segurança (`dentroDe`)
- `public/js/ui/componentes.js` — `ocuparAteRodape` (altura até o pé da janela)
- `public/js/ui/graficos.js` — `graficoCategorias` (barras/linha por categoria com rótulos de valor)
- `public/js/ui/planilha.js` — `baixarPlanilha` (gera o modelo .xlsx)
- `public/js/ui/icones.js` — ícones `escudo` e `alerta`
- `public/css/tokens.css` — `--acidente-spt/cpt/trj/ft` (apontam para cores já existentes da identidade)
- `public/css/paginas.css` — seção "Segurança do Trabalho"
- `server/app.mjs` — repositório `acidentes` e rotas
- `server/routes/dados.mjs` — excluir cadastro de obra com acidentes → 409
- `server/supabase/cliente.mjs` — `consultar` (filtros PostgREST + total) e `inserirVarios`
- `tests/api/supabase-falso.mjs` — operadores `in/gte/lte/ilike`, paginação, contagem, lote, chave única
- `CHANGELOG.md`, `README.md`, `docs/API.md`, `docs/SUPABASE_VERCEL.md`

Variáveis de ambiente: nenhuma nova.

## Publicação

1. Rodar `003_seguranca_trabalho.sql` no SQL Editor do Supabase (depois do 001 e 002).
2. `npm run verificar` (checagens + testes de domínio/API + testes de tela).
3. Commit numa branch própria (sugestão `feature/seguranca-trabalho`) e PR para `main`; a Vercel publica como hoje.

## Pontos para validar com o usuário / Segurança do Trabalho

1. **Resumo obrigatório × histórico**: na planilha real, 37 das 142 linhas não têm resumo (e algumas não têm parte do
   corpo ou dias). **Decisão (04/11/2026): manter obrigatório** — essas linhas aparecem como erro na
   pré-visualização e só entram depois de completadas na planilha (a reimportação reconhece as já gravadas).
2. **Dias Debitados (DD)**: o modelo do indicador tem a coluna DD, mas ela não está entre os campos do cadastro. Não foi
   inventada; se for necessária (ex.: NBR 14280 para fatal/incapacidade permanente), definir a regra ou incluir o campo.
3. **Segmentador Ano**: no Excel ele só filtra 3 gráficos (por ano, por fase, por período). No app ele filtra o
   dashboard inteiro, para os números da tela serem coerentes entre si.
4. **Fase da obra**: lista da aba Dados (Fundação, Estrutura, Acabamento, Assistência Técnica).
5. Pesquisa por nome/empresa: no modo local ignora acentos; no Supabase (`ilike`) diferencia acentos.
