# Changelog

Cada versão só é fechada com `npm run verificar` passando.

| Ambiente | Versão |
|---|---|
| Produção | — (ainda não publicada) |
| Dev (local) | v10 |

## v10 — 16/10/2026 — app sem tela de login (temporário)

- `LOGIN=desligado` no `.env.local` (ou nas variáveis da Vercel) abre o app direto, sem tela de login: toda
  requisição usa o usuário "Acesso livre" com o papel `PAPEL_SEM_LOGIN` (`dev`, `planejamento` ou `viewer`;
  padrão `planejamento`, que não vê a gestão de usuários). Sem a variável o login continua obrigatório.
- No modo sem login o cabeçalho não mostra o usuário nem o botão Sair. O código de login segue intacto.
- Correção da simulação sem atividades: cada coluna só é simulada se os itens pai fecham com o total da obra
  (tolerância de 1 p.p.). Em obras cuja planilha traz o acumulado na coluna do mês das atividades (ex.: Flow Vila
  Matilde), "Realizado mês", "Planejado mês" e "% acerto" ficam "—" com um aviso, em vez de valores sem sentido.
- Testes: 66 (4 do modo sem login, 1 da simulação) + 16 de tela.

## v09 — 16/10/2026 — competência em destaque e simulação sem atividades

- **Mês de competência em destaque**: selo laranja "Competência · Março de 2026" no título do Resumo Físico, do
  Resumo Econômico e do Resumo Geral; o filtro "Mês de referência" ganha destaque na barra de filtros.
- **Resumo Físico — simular sem atividades**: botão "Simular sem atividades" liga uma caixa "retirar" em cada item
  e uma linha **Simulação** logo abaixo da linha da obra, com todas as colunas recalculadas sem os itens marcados.
  Um painel compara oficial × simulado (realizado acm, planejado acm, desvio da meta, cronograma, adiantamento e
  % acerto). O peso de cada item é o orçamento dele ÷ soma dos orçamentos dos itens pai (conferido com as
  planilhas reais): `simulado = (total − Σ peso × valor) ÷ (1 − Σ peso)`. Cálculo em
  `domain/simulacao-fisico.js`; nenhum cálculo existente foi alterado. Item sem orçamento não pode ser retirado.
- Títulos das colunas do Resumo Físico e do Resumo Econômico maiores (12 → 14 px).
- Testes: 61 (6 novos da simulação) + 16 de tela.

## v08 — 15/10/2026 — Supabase + Vercel

- **Supabase** como banco de produção (`STORE=supabase`): login, senhas e criação de usuários no **Supabase Auth**;
  papéis na tabela `perfis`; `cadastro_obras`, `midias`, `telas` e `arquivos` no Postgres; anexos no **Storage**
  (bucket privado). Obras e curvas continuam só no SharePoint.
- **Anexos direto ao Storage** por URL assinada (`POST /api/arquivos/envio`), sem o limite de 4,5 MB da Vercel;
  leitura por redirecionamento para URL assinada.
- Cache das planilhas e INCC no Storage, compartilhado entre as instâncias da Vercel.
- **Vercel**: `api/index.mjs` (função única) + `vercel.json` (estáticos em `public/`, build com checagens e testes).
- `supabase/migrations/001_apresentacao.sql` (RLS fechado; validado em PGlite) e `npm run migrar:supabase` para
  levar o conteúdo do modo local. Guia: `docs/SUPABASE_VERCEL.md`.
- Modo local (`STORE=local`) mantido para desenvolvimento, testes e demonstração; contrato REST igual nos dois.
- A API recusa partir se `SUPABASE_SERVICE_ROLE_KEY` tiver a chave pública (publishable/anon) — com ela o RLS
  devolvia listas vazias sem erro. Testes de tela e modo demonstração fixados em `STORE=local`.
- Testes: 55 (a suíte de contrato roda nos dois modos, o Supabase contra um simulador em memória; leitura das
  planilhas; migração) + 15 de tela.

## v07 — 15/10/2026 — Tempo x Caminho e Fotos

- Galeria nova nas abas **Tempo x Caminho** e **Acompanhamento Fotográfico**: linha do tempo com os meses que têm
  imagens (com contagem e destaque do mês de referência), abas por torre/local com contagem, palco escuro com
  setas sobre a imagem e contador, painel lateral com torre/local, mês e comentário, miniaturas, navegação pelas
  setas ← → do teclado e botão "Ampliar" (tela cheia, fecha com Esc).
- Correções: telas do cliente apareciam no menu/capa só depois de navegar; cabeçalho das planilhas das telas do
  cliente desalinhado; menu com muitas telas espremia o botão Obra/Cliente.
- Relatórios: `docs/MANUAL_DE_USO.html` (uso) e `docs/MAPA_DE_DADOS.html` (funcionalidades e origem de cada
  informação, com telas anotadas). Para atualizar: `node tests/tools/capturar-telas.cjs` e `node docs/relatorios/gerar.mjs`.
- Testes: 39 + 15 de tela.

## v06 — 15/10/2026 — rodapé congelado no Resumo Econômico

- As 6 caixas do rodapé do Resumo Econômico (custo pago no mês, passível de reajuste, aditivos, custos não
  incidentes, variação do mês) ficam congeladas no pé da tela enquanto a página ou a tabela rolam; com pouco
  conteúdo continuam coladas ao pé.
- Indicadores do topo (9) e do rodapé (6) sempre numa linha a partir de 1100 px / 900 px de largura.
- Testes: 39 + 14 de tela.

## v05 — 15/10/2026 — Resumo Econômico no formato do Físico

- **Resumo Econômico** com a mesma apresentação do Resumo Físico: faixa de grupos no cabeçalho (Execução,
  Projeção, Resultado, Sem correção, Contratação), linha total com o nome da obra e itens recolhíveis.
- Detalhe de cada item em grade simétrica: 3 linhas × 4 caixas (Custos, Saldos, Mês e aditivos) com os
  comentários ao lado; indicadores do topo numa linha (R$ compactos, valor completo ao passar o mouse).
- **Marcador de comentário único** nos dois resumos (selo laranja "comentário"); no Econômico ele abre o detalhe.
- **Resumo Físico**: botão "Ocultar/Exibir projeção econômica e pesos" (a escolha fica lembrada no navegador).
- Testes: 39 + 13 de tela.

## v04 — 15/10/2026 — capa do cliente e acabamento do Resumo Geral

- Capa da apresentação **Cliente** sem indicadores da empresa (obras ativas, assertividade média, maior
  assertividade, unidades no mês): mostra só a obra apresentada (seletor de obra), com avanço realizado,
  planejado acumulado e desvio nas colunas "- Cliente".
- **Resumo Geral**: fonte maior (até 16 px em Full HD), títulos com acento laranja, cabeçalhos CEF/Físico em
  pílulas, desvios como selos coloridos com seta, custos por unidade em blocos, INCC com selo de reajuste,
  gráficos com linhas mais encorpadas, barras arredondadas e eixos maiores. Continua sem rolagem em
  1366×768, 1600×900 e 1920×1080 (em telas baixas os textos auxiliares do rodapé somem).
- Testes: 39 + 11 de tela (capa do cliente; análise econômica sem rolagem interna).

## v03 — 15/10/2026 — ficha da obra

- "+ Infos da obra" virou uma ficha em tela cheia: cabeçalho grafite com logo Unità, cliente, endereço, Nº UAU e
  situação; destaques coloridos (avanço físico, UH, áreas, torres); cartões de Equipe (com iniciais),
  Características, Prazos (linha do tempo) e Orçamento/INCC. Fecha com Esc ou "Fechar".
- Testes: 39 + 10 de tela.

## v02 — 15/10/2026 — revisão visual e usabilidade

- **Início** virou a capa do app: marca, mês de fechamento, 4 indicadores (obras ativas abre a lista) e atalhos
  para as abas; sem barra de filtros.
- **Resumo Geral** cabe numa tela só, sem rolagem (testado em 1920×1080 e 1366×768): altura ajustada à janela,
  gráficos dividem o espaço livre, análise econômica em grade e valores compactos (R$ 13,5 mi) quando a tela é baixa.
- **Filtros estilo Excel**: pesquisa, "(Selecionar tudo)", obras agrupadas por cliente, meses agrupados por ano,
  OK/Cancelar; com pesquisa ativa o OK aplica só os resultados (como no Excel).
- **Resumo Físico**: itens pai recolhem/expandem (começa recolhido), "Expandir tudo"/"Recolher tudo"; fontes maiores.
- **Resumo Econômico**: cada item expande com os demais valores e os comentários.
- **Visual "soft clean"**: cantos maiores, sombras difusas, bordas claras; área de arrastar-e-soltar com
  miniaturas no lugar dos botões de arquivo; ícones no cabeçalho.
- **BD_Físico por atividade**: a aba (~25 mil linhas) levava ~10 s na 1ª abertura e parecia travada. Agora o
  servidor pré-carrega as planilhas ao iniciar, serve o cache vencido na hora e atualiza em segundo plano, e
  repete a leitura uma vez se o Graph falhar; a tela mostra "Carregando as atividades…".
- Testes: 39 (domínio + API + leitura das planilhas) e 9 de tela.

## v01 — 15/10/2026 — primeira versão

- Apresentações Obra e Cliente com as abas Início, Resumo Geral, Resumo Físico, Resumo Econômico, Tempo x Caminho e
  Acompanhamento Fotográfico; telas extras do cliente (planilha somente leitura, imagem, texto).
- Leitura das abas BD_Físico por atividade, BD_Infos Gerais, BD_Orc e BD_Econômico pelo Microsoft Graph, com cache e
  fallback para o último cache se o SharePoint falhar.
- Medidas do Power BI traduzidas para `public/js/domain` (correções listadas em `docs/CALCULOS.md`).
- INCC-DI mês a mês: histórico FGV + atualização automática pelo Banco Central (série 192) + correção manual.
- Cadastro de obras no app (UH, áreas, INCC base, prazos, equipe) com importação da planilha "Painel de Obras".
- Papéis Dev / Planejamento / Viewer; login com sessão assinada; primeiro acesso cria o Dev.
- Filtro por obras (várias) e período; mês de referência = último mês fechado.
- Testes: 35 (domínio + contrato da API) e 6 de tela.
- Documentação: contrato REST, migração para PHP, cálculos, estudo de integração com o app TxC.
