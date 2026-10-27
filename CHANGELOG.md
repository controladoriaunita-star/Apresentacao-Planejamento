# Changelog

Cada versão só é fechada com `npm run verificar` passando.

| Ambiente | Versão |
|---|---|
| Produção | — (ainda não publicada) |
| Dev (local) | v19 |

## v19 — 27/10/2026 — novas telas e imagens na apresentação Obra, Cliente ou ambas

- Administração → **Telas do cliente** passa a se chamar **Novas telas**. Cada tela tem a caixa **Apresentação**:
  Obra e Cliente, Somente Obra ou Somente Cliente. Na Obra, as telas entram no menu de abas (rota
  `#/obra/tela/<id>`), como já acontecia no Cliente.
- **TxC e fotos**: a caixa **Apresentação** substitui "Exibir na apresentação ao cliente". "Somente Cliente" é novo:
  a imagem não aparece na Obra.
- Registros antigos continuam iguais: telas → Somente Cliente; imagens → Obra e Cliente (ou Somente Obra, se
  estavam ocultas para o cliente). Regra em `domain/conteudo.js` (`DESTINOS`, `destinoDaTela`, `destinoDaMidia`).
- Supabase: rodar `supabase/migrations/002_destino_telas_midias.sql` **antes** de publicar (coluna `destino`).

## v18 — 22/10/2026 — Painel de obras com colunas fixadas e grupos compactos

- Saem do painel os grupos **Projeções/Tendência** e **Taxa Adm** (os cálculos continuam em
  `domain/painel-obras.js`, só não são exibidos).
- **Colunas fixadas**: o alfinete no título de cada coluna a fixa na tela inicial — ela continua visível com o grupo
  recolhido. O painel sempre abre com os grupos recolhidos, mostrando só as fixadas (lembradas no navegador; padrão:
  Avanço acumulado, Assertividade, Meta projetada acumulada, Realizado × curva atual do Cliente, Término meta obra,
  Realizado × curva plat. atual e IEC contrato — `FIXADAS_PADRAO` em `ui/painel-obras.js`).
- **Segmentadores**: os rótulos verticais deram lugar a uma barra de pílulas acima da tabela (com o nº de colunas
  fixadas no grupo recolhido) e a uma faixa fina com o nome do grupo sobre as colunas dele — o cabeçalho da tabela
  ficou bem mais baixo.

## v17 — 21/10/2026 — botão "Atualizar dados" na capa

- Capa (visão Obra e Cliente): botão **Atualizar dados** e a data/hora da última leitura do SharePoint, ao lado do
  mês de referência. Some no modo apresentação, como os demais controles de edição.
- `POST /api/dados/atualizar` passa a devolver o resumo já relido (mesmo corpo de `/dados/resumo`). Antes o
  navegador relia num GET separado que, na Vercel, podia cair em outra instância com o cache em memória ainda
  antigo (até 30 min) — por isso às vezes os dados não pareciam atualizar.
- O aviso de sucesso mostra a hora da leitura.

## v16 — 20/10/2026 — capa da visão Obra sem o logo grande

- Retirado o logo grande da capa (visão Obra); o título sobe para o topo e divide a faixa com os quatro indicadores e
  o mês de referência.
- Indicadores mais compactos (menos espaço interno e números menores).
- A capa passa a ter a altura da tela e o Painel de obras ocupa toda a altura que sobra (a tabela rola por dentro);
  em 1440 × 900 a faixa do topo caiu de ~170 px para ~100 px. A capa do Cliente não muda.

## v15 — 19/10/2026 — capa da visão Obra mais compacta

- Capa da visão Obra em largura total: logo no canto esquerdo e mês de referência no direito; título e os quatro
  indicadores na mesma faixa, para o Painel de obras subir e ganhar espaço na tela. A capa do Cliente não muda.
- Painel de obras em cinza da paleta (ink-100 no quadro, ink-50 na tabela) no lugar do branco.
- Com os grupos recolhidos, as colunas ficam juntas à esquerda (antes a coluna da obra esticava e a tabela parecia
  vazia).

## v14 — 19/10/2026 — app dentro do Portal Unità (iframe)

- Retirado o cabeçalho `X-Frame-Options: SAMEORIGIN` (vercel.json e respostas da API), que fazia o navegador
  recusar o app dentro do iframe do Portal Unità. Fica igual ao Quadro de Concorrência, que o portal já incorpora.
- Quando o login for reativado, o cookie de sessão (`SameSite=Strict`) precisará de `SameSite=None; Secure` para
  funcionar dentro do iframe.

## v13 — 19/10/2026 — Painel de obras na capa

- Na capa (visão Obra), os atalhos para as abas deram lugar ao **Painel de obras**, réplica da aba "Painel" da
  planilha `Painel de Obras.xlsm`: uma linha por obra do cadastro (manual ou importado), nome da obra como link que
  filtra a obra e abre o Resumo Geral. A capa do Cliente continua com os atalhos.
- Colunas agrupadas como na planilha (Informações Gerais, Gestão de Obra, Datas, Realizado, Meta, Físico Cliente,
  Físico Obra, Projeções/Tendência, Econômico, Áreas e Taxa Adm). O rótulo vertical de cada
  grupo recolhe/expande as colunas (lembrado no navegador); filtro Ativas / Todas do cadastro.
- Fontes: BD_Fixo → cadastro de obras; BD_Físico Geral → BD_Infos Gerais (colunas Obra e "- Cliente"); BD_Econômico
  (item Geral) e INCC no mês de referência; orçamento raso → BD_Orc Geral. Cálculos em `domain/painel-obras.js`
  (DATEDIF, status Atrasada/Adiantada, custo por área corrigido pelo INCC). O bloco mensal "Acumulada no Ano" da planilha ficou de fora.
- Ocultas até termos a origem: Persona sem emissão, Taxa emitida/recebida/mês, Regime e Taxa projetada (na
  planilha dependem de linhas mensais com #REF! ou são valores digitados). Término projetado planejamento usa o "Fim Projetado de obra"
  do BD_Infos Gerais (na planilha é digitado).
- Cadastro de obras: novos campos Orçamento com taxa, impostos e adicionais, Taxa adm inicial (R$), Taxa (%) e Fim
  projetado (real). A importação aceita a aba BD_Fixo (cabeçalho na linha 2) e só grava os campos presentes na
  planilha (não apaga os demais).

## v12 — 16/10/2026 — Resumo Físico sem comentários no cabeçalho

- Retirados os quadros "Comentário do mês" e "Principais metas" do topo do Resumo Físico (obra e cliente); os
  comentários de cada atividade continuam no marcador da tabela.

## v11 — 16/10/2026 — bateria de testes da API

- `npm run bateria -- <endereço>` testa um servidor no ar (dev ou Vercel) **só com leituras**: funcional (cada rota
  com o status e o formato do contrato, com os dados reais do SharePoint e do Supabase), estabilidade (rodadas em
  sequência) e carga (requisições simultâneas), com mediana/p95/máx. `--relatorio arquivo.md` salva a tabela.
- Primeira rodada (16/10): dev e Vercel sem falhas; na Vercel, 50 simultâneas no resumo das planilhas com p95 de
  4,1 s e nenhum erro.

## v10 — 16/10/2026 — login desativado para testes (temporário)

- **Login desativado temporariamente** para testar a plataforma sem entrar: toda requisição usa o usuário
  "Testes" (papel Dev). Para reativar, trocar `LOGIN_DESATIVADO` para `false` em `server/app.mjs`. Não depende de
  variável de ambiente (vale no dev e na Vercel). Os testes automáticos continuam rodando com login
  (`EXIGIR_LOGIN=true`). Substitui a tentativa anterior com `LOGIN=desligado`, que foi desfeita.
- Correção da simulação sem atividades: cada coluna só é simulada se os itens pai fecham com o total da obra
  (tolerância de 1 p.p.). Em obras cuja planilha traz o acumulado na coluna do mês das atividades (ex.: Flow Vila
  Matilde), "Realizado mês", "Planejado mês" e "% acerto" ficam "—" com um aviso, em vez de valores sem sentido.
- Testes: 62 (1 novo da simulação) + 16 de tela.

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
