# Changelog

Cada versão só é fechada com `npm run verificar` passando.

| Ambiente | Versão |
|---|---|
| Produção | — (ainda não publicada) |
| Dev (local) | v27 (em validação — ainda não publicada) |

## v27 — 10/11/2026 — quadros do Resumo Geral responsivos (tela e PDF)

- Junta na mesma branch a v24 (Resumo Geral em grade ajustável pelo Dev), a v25 (Exportar PDF da apresentação
  Cliente) e a v26 (acesso por obra e por apresentação).
- **Quadros que se adaptam ao próprio tamanho**: ao redimensionar um quadro em "Editar layout" (ao vivo, enquanto
  arrasta) ou ao mudar o tamanho da janela, cada quadro de valores usa a **maior fonte com que o conteúdo cabe**,
  entre 10 e 24 px. Os rótulos quebram linha quando o quadro estreita; os valores nunca quebram nem são cortados.
  - Análise econômica escolhe entre 1, 2 ou 3 colunas e Custos por entre 4 em linha, 2 × 2 ou 1 coluna: fica o
    arranjo que permite a fonte maior.
  - CEF × Físico, INCC e NH-NU só ajustam a fonte; o velocímetro já acompanhava o quadro.
  - Quadro tão pequeno que nem na fonte mínima cabe: rola por dentro.
  - Gráficos (curva, barras e assertividade): a fonte dos eixos e dos rótulos acompanha o tamanho do gráfico
    (10 a 16 px); em quadro estreito a legenda desce para baixo do título.
  - Substitui a regra anterior que passava a Análise econômica para 3 colunas quando não cabia na altura.
- **PDF**: o Resumo Geral usa o mesmo ajuste no tamanho da página (fonte de 9 a 18 px); a página só é ampliada e
  reduzida se algum quadro não couber nem na fonte mínima. Com o layout padrão sai sem redução.
- Arquivos: `pages/resumo-geral.js` (`ajustarQuadros`), `pages/exportar-pdf.js`, `ui/graficos.js`
  (`fonteProporcional`, só nos gráficos do Resumo Geral), `css/paginas.css`, `css/impressao.css`. Nenhum cálculo mudou.
- Teste de tela: Dev estreita a Análise econômica e a fonte diminui sem cortar valores; ao cancelar, volta.

## v26 — 10/11/2026 — acesso por obra e por apresentação (Administração → Usuários)

- Em **Administração → Usuários**, para o papel **Viewer**: escolher a **apresentação** (Obra e Cliente, Somente Obra
  ou Somente Cliente) e as **obras** — "Todas as obras" (padrão; inclui as que entrarem depois na planilha) ou
  "Somente as obras selecionadas", com a lista agrupada por cliente e uma caixa que marca o cliente inteiro (o que
  fica gravado são as obras; obra nova do mesmo cliente precisa ser marcada). Nenhuma marcada = não vê nenhuma obra.
  A tabela de usuários ganhou a coluna **Acesso**. Dev, Planejamento e Segurança continuam vendo tudo. Usuários
  atuais e novos começam com todas as obras, Obra e Cliente.
- A restrição vale **no servidor** (regras em `public/js/domain/acesso.js`): `/dados/resumo` e `/dados/atualizar` só
  levam as linhas e o cadastro das obras liberadas, `/dados/fisico` de outra obra dá 403, mídias, telas extras,
  arquivos e acidentes/indicadores da Segurança do Trabalho são filtrados pela obra e pela apresentação. Quem tem
  só o Cliente não recebe as colunas "- Obra" das planilhas (previstos, comentários e metas internos). Muda na hora,
  sem novo login.
- Front: o filtro de obras, o Painel de obras e a capa já mostram só as obras recebidas; o seletor Obra/Cliente
  some quando só uma apresentação está liberada, o login abre direto nela e a rota direta da outra leva à mesma aba
  da liberada. Sem nenhuma obra liberada aparece o aviso "Nenhuma obra liberada".
- A exportação em PDF (PR da v25) usa os dados já carregados no navegador e só existe na apresentação Cliente, então
  segue a mesma regra sem mudança.
- Supabase: rodar `supabase/migrations/005_acesso_por_obra.sql` (colunas `obras` e `apresentacoes` em `perfis`)
  antes de publicar.
- Testes: contrato da API com Viewer restrito nos dois armazenamentos (planilhas, colunas, físico, cadastro, mídias,
  telas, arquivos, Segurança do Trabalho) e teste de tela `tests/e2e/04-acesso-por-obra.spec.cjs`.

## v25 — 10/11/2026 — Exportar PDF da apresentação Cliente

- **Botão "Exportar PDF"** no topo da apresentação **Cliente** (só Dev e Planejamento — capacidade nova
  `exportarPdf` em `domain/permissoes.js`; some no modo Apresentar). Abre uma janela com a **obra** (padrão: a da
  capa do Cliente) e as **seções**, todas marcadas, na ordem das abas: Capa, Resumo Geral, Resumo Físico, Resumo
  Econômico, Tempo x Caminho, Acompanhamento Fotográfico, Segurança do Trabalho (se a obra estiver marcada para o
  Cliente) e as telas extras do Cliente daquela obra. Competência = mês de referência do filtro.
- **Como sai**: o app monta o documento e abre a impressão do navegador — escolher **"Salvar como PDF"** (nome
  sugerido: `Unità - <obra> - Apresentação ao cliente - <AAAA-MM>`). Nada é gerado no servidor (sem custo na Vercel).
  - **A4 paisagem**, capa escura com logo, obra, cliente, os 3 indicadores da capa e o sumário (sem cabeçalho);
    nas demais páginas, cabeçalho com obra · cliente e competência, rodapé com "gerado em" e **Página X de Y**.
  - Cada seção começa numa página nova e mostra o mesmo conteúdo da tela do Cliente (mesma base e mesmas funções de
    tela), sem botões nem filtros.
  - **Resumo Geral, Resumo Físico e Resumo Econômico: uma página cada, inteiros, com a menor redução possível.**
    O Resumo Geral usa o layout do Dev: a grade começa no tamanho da página e só cresce (e é reduzida) até nenhum
    quadro de valores ficar cortado; na impressão as linhas do CEF × Físico, da Análise econômica e do INCC ficam
    mais justas para precisar de menos redução. Físico e Econômico saem como abrem na tela (só os itens principais,
    sem subitens nem detalhes) e ocupam a página: quando a altura é o limite, a tabela é alargada (descrições
    quebram menos) até preencher também a largura; sobrando altura, as linhas ficam mais altas; tabela pequena
    pode ser ampliada até 1,2×.
  - **Sem o selo "Competência" nas seções** e sem o título repetido no Resumo Geral: obra e competência já estão no
    cabeçalho de toda página (o Resumo Geral ganha a altura). Itens sem subitens não ficam mais recuados no Físico.
  - Nas demais tabelas (telas extras, Segurança) as largas são reduzidas para caber na largura, o cabeçalho se
    repete em cada página e nenhuma linha/quadro é cortado ao meio.
  - **TxC e fotos**: as imagens visíveis ao cliente do mês de referência (sem imagens no mês: o anterior mais recente,
    como na tela), por torre/local e com o comentário — TxC uma por página, fotos duas. Seção sem imagens fica fora.
  - Gráficos convertidos em imagem de alta resolução (3×) antes de imprimir: nítidos no PDF.
- Arquivos: `pages/exportar-pdf.js`, `css/impressao.css`. Ajustes pequenos para reutilizar as telas com a obra do PDF:
  `obraUnica` aceita o filtro, `mesExibido` (galeria) e `dadosCapaCliente` (capa) exportados, Resumo Geral e
  Segurança do Trabalho reconhecem a montagem para impressão. Nenhum cálculo mudou.
- Testes: permissão (`tests/domain/permissoes.test.mjs`) e tela (`tests/e2e/03-exportar-pdf.spec.cjs`): botão só no
  Cliente e não para o Viewer, seções da janela, documento com as seções na ordem, sem canvas/botões, Físico e
  Econômico recolhidos, os três resumos dentro de uma página e nenhum quadro do Resumo Geral cortado, TxC com torre
  e comentário, regras da página, PDF real gerado pelo Edge com uma página por seção ao
  menos, e limpeza depois de imprimir.
- Dica: se o navegador mostrar o próprio cabeçalho/rodapé (data, endereço), desmarcar "Cabeçalhos e rodapés" em
  "Mais configurações" da janela de impressão.

## v24 — 10/11/2026 — Resumo Geral em grade ajustável pelo Dev, gráficos até o 100% + 1 mês

- **Intervalo dos gráficos sem seleção**: saem os filtros "De" e "Até". Os gráficos vão do primeiro mês da obra até o
  mês seguinte àquele em que o planejado atual chega a 100% (ex.: 100% em fevereiro → último mês março), nunca antes
  do mês de referência nem depois do último mês da planilha.
- **Rótulos de dados também na curva acumulada** (Realizado acima do ponto, Planejado atual abaixo; na vertical
  quando os meses ficam próximos). As barras já tinham (v19).
- **Todos os meses legíveis no eixo**: mês em duas linhas ("JAN" sobre "25"), sem pular meses; a legenda das
  séries subiu para a linha do título e sobra mais altura para o gráfico.
- **Tela toda coberta**: em tela cheia os quadros formam uma grade de 24 × 24 que ocupa a área inteira (sem espaço
  vazio no rodapé); cada quadro estica o conteúdo até as bordas.
- **Editar layout (Dev)**: botão no título do Resumo Geral. Arrastar move o quadro, a alça no canto o redimensiona,
  tudo encaixado na grade (como os widgets da Apple); um quadro não cobre outro (fica vermelho e volta). Teclado:
  setas movem, Shift + setas redimensionam. "Salvar para todas as apresentações" grava no servidor
  (`PUT /api/layouts/resumo-geral`, armazém de documentos — sem migration no Supabase); "Restaurar padrão" volta ao
  layout do app. Em telas pequenas os quadros ficam um abaixo do outro e a edição some.
- Testes: grade (padrão cobre a tela sem sobreposição, limites, recusa de sobreposição), contrato da rota (só o Dev
  salva; todos recebem no resumo) e tela (Dev redimensiona, salva, recarrega e restaura).

## v23 — 05/11/2026 — Segurança do Trabalho na Obra/Cliente, papel Segurança e imagens em qualquer formato

- Módulo Segurança do Trabalho (v22, feito à parte a partir da mesma `main`) trazido para o projeto, com:
  - Aba **Segurança do Trabalho** é **padrão na apresentação Obra** e **opcional no Cliente**: só aparece (menu,
    atalhos da capa e seletor "Obra exibida") para as obras marcadas no Cadastro de obras → grupo **Apresentação** →
    "Segurança do Trabalho na apresentação Cliente" (padrão: Não exibir). Campo novo dentro de `dados` do cadastro —
    sem migration. Trocar para uma obra não marcada estando na aba leva à capa do Cliente.
- Novo papel **Segurança**: entra direto em Administração → Segurança do Trabalho; vê só essa seção e o Dashboard
  Segurança (sem apresentações, sem Obra/Cliente, sem Apresentar). Não carrega os dados das planilhas: as obras vêm de
  `GET /api/seguranca/obras` (só id, nome, cliente e sistema estrutural). Capacidades novas em `domain/permissoes.js`:
  `verSeguranca` (ler acidentes/indicadores — todos os papéis), `editarSeguranca` (Dev, Planejamento, Segurança) e
  `conta` (trocar a própria senha — todos). Supabase: rodar `supabase/migrations/004_papel_seguranca.sql`.
- **Imagens em qualquer formato** (TxC e fotos, blocos de imagem das Novas telas). Antes: só PNG, JPG, WEBP e GIF.
  Agora também HEIC/HEIF (iPhone), TIFF, BMP, AVIF, SVG, ICO, JFIF…: o navegador converte para JPG (fotos) ou PNG
  (SVG/ICO/AVIF/BMP) antes do envio (`ui/imagem.js`), então o servidor e o Storage continuam guardando só formatos que
  qualquer navegador abre (SVG nunca é servido cru). HEIC usa `vendor/heic2any.min.js` e TIFF `vendor/utif.js` +
  `vendor/pako_inflate.min.js`, carregados só quando necessários. Arquivo que não é imagem, inclusive arrastado para
  a área de envio, passa a ser recusado com aviso.
- Testes: papel Segurança na API (local e Supabase simulado) e 3 testes de tela novos
  (`tests/e2e/02-seguranca-e-imagens.spec.cjs`, com imagens de exemplo em `tests/fixtures/imagens`).

## v22 — 04/11/2026 — módulo Segurança do Trabalho

- **Administração → Segurança do Trabalho** (Planejamento/Dev): cadastro manual de acidentes (todos os campos
  obrigatórios; Incorporador e Método construtivo preenchidos pelo Cadastro de obras), **Baixar modelo** (.xlsx com as
  abas Dados, Listas e Instruções), **Importar planilha** com pré-visualização (novos, já cadastrados, repetidos na
  planilha, com erro), de-para de nomes de obra e gravação só dos registros novos e válidos, e **tabela histórica**
  com filtros (obras, período, tipo), pesquisa (acidentado, empresa), ordenação por data, paginação no servidor,
  detalhes, edição e exclusão.
- **Dashboard Segurança** — sub-aba de Administração → Segurança do Trabalho (botão "Dashboard Segurança", rota
  `#/admin/seguranca-dashboard`): os indicadores das abas Dashboard-01 e Dashboard-02 da planilha
  "Controle de Acidentes-Dashboard.xlsx". Quadro de totais (total, média de dias de afastamento, classificação) e um
  botão por indicador — por período, classificação (colorida por tipo), fase, ano, parte do corpo, obra, função e
  empresa (10 primeiros com empates, como as tabelas dinâmicas). O indicador escolhido ocupa o resto da tela, com
  gráfico e ranking (quantidade e % do total). Filtros: obras do cadastro e segmentador de ano.
- Nova aba **Segurança do Trabalho** (Obra e Cliente): tabela por período e gráfico de colunas "Nº de acidentes
  ocorridos no mês" por tipo (SPT, CPT, TRJ, FT), como o "Modelo - Indicador Segurança do Trabalho". O gráfico vai até
  o pé da tela; eixo de 1 mês antes do primeiro acidente a 1 mês depois do último (meses sem acidente no meio ficam),
  com no mínimo 12 meses. Em tela cheia segue a obra do filtro geral; fora dela, o seletor "Obra exibida" permite
  outra obra ou todas.
- Prevenção de duplicidade na planilha acumulativa: chave = data + obra + acidentado + tipo + parte do corpo + função +
  empresa (`chaveDedup`, única no banco).
- Cadastro de obras: excluir uma obra com acidentes passa a ser recusado (409), em vez de deixar acidentes órfãos.
- Supabase: rodar `supabase/migrations/003_seguranca_trabalho.sql` **antes** de publicar (tabela `acidentes`).
- Testes: `tests/domain/seguranca.test.mjs` e `tests/api/seguranca.test.mjs` (local e Supabase simulado). O simulador
  do Supabase passou a entender `in.`, `gte.`, `lte.`, `ilike.`, `limit/offset`, `count=exact` e inserção em lote.
- Detalhes técnicos e pendências: `docs/SEGURANCA_TRABALHO.md`.

## v21 — 27/10/2026 — novas telas e imagens na apresentação Obra, Cliente ou ambas

- Administração → **Telas do cliente** passa a se chamar **Novas telas**. Cada tela tem a caixa **Apresentação**:
  Obra e Cliente, Somente Obra ou Somente Cliente. Na Obra, as telas entram no menu de abas (rota
  `#/obra/tela/<id>`), como já acontecia no Cliente.
- **TxC e fotos**: a caixa **Apresentação** substitui "Exibir na apresentação ao cliente". "Somente Cliente" é novo:
  a imagem não aparece na Obra.
- Registros antigos continuam iguais: telas → Somente Cliente; imagens → Obra e Cliente (ou Somente Obra, se
  estavam ocultas para o cliente). Regra em `domain/conteudo.js` (`DESTINOS`, `destinoDaTela`, `destinoDaMidia`).
- Supabase: rodar `supabase/migrations/002_destino_telas_midias.sql` **antes** de publicar (coluna `destino`).

## v20 — 27/10/2026 — login ligado para os colaboradores da Unità

- **Fim do modo sem login** (usuário fixo "Testes", desde a v10): sai a constante `LOGIN_DESATIVADO` de
  `server/app.mjs` e a variável de teste `EXIGIR_LOGIN`. Todo acesso exige login, no dev e na Vercel.
- **Só e-mails @unitaengenharia.com.br**: o primeiro acesso e a criação de usuários recusam outro domínio
  (`DOMINIO_EMAIL`, novo em `.env.example`; vazio = qualquer domínio). Quem já tem login continua entrando.
- **Convite por e-mail** (Supabase): em *Administração → Usuários → Novo usuário* o Dev informa nome, e-mail e papel
  (padrão Viewer), sem senha. O Supabase envia o convite; o link abre o app na tela "crie a sua senha" e a pessoa já
  entra. A lista mostra "Convite enviado" até o primeiro acesso, e *Editar → Reenviar e-mail de acesso* manda o link
  de novo. No modo local (dev/testes) continua a senha inicial definida pelo Dev.
- **Esqueci minha senha** na tela de login (Supabase): envia o link de nova senha, sem revelar se o e-mail existe.
- **Login dentro do iframe do Portal Unità**: em HTTPS o cookie de sessão sai com `SameSite=None; Secure;
  Partitioned` (era `SameSite=Strict`, que o navegador não envia dentro do iframe de outro site); em http://localhost,
  `SameSite=Lax`. As escritas seguem protegidas contra CSRF pelo cabeçalho `X-Requested-With`.
- Novas rotas: `POST /api/auth/recuperar`, `POST /api/auth/definir-senha` e `POST /api/usuarios/:id/acesso`;
  `GET /api/auth/sessao` informa `convite`. Configuração do SMTP e das Redirect URLs no Supabase em
  `docs/SUPABASE_VERCEL.md` → "Login e convites".
- Testes: contrato com o convite, o reenvio, o "esqueci minha senha", o domínio e os atributos do cookie (local e
  Supabase simulado).

## v19 — 26/10/2026 — ajustes do Resumo Geral, farol do econômico e simulação de volta

- **Resumo Geral**: os três gráficos vão só até o último mês do replanejado atual (o mês em que ele chega ao valor
  final), nunca antes do mês de referência. Os gráficos de barras ganharam rótulo de dados (na vertical quando a
  barra é estreita) e o eixo da Assertividade vai ao menos a 100%.
- Resumo Geral: todos os meses aparecem no eixo dos gráficos (inclinados quando não cabem) e os quadros da
  esquerda e do rodapé ficaram com espaçamento enxuto, para os gráficos ganharem tamanho (em 1440 × 900 passam
  de ~820 × 64 px para ~1000 × 108 px).
- Resumo Geral: as linhas do quadro CEF × Físico e da Análise econômica se distribuem pela altura disponível
  (sem sobra vazia no pé em telas altas; continuam enxutas em notebooks).
- Resumo Geral: o velocímetro "Andamento geral" ocupa todo o quadro e acompanha o tamanho da tela
  (~154 px de largura em 1366 × 768, ~180 px em 1440 × 900 e ~216 px em 1920 × 1080).
- **Resumo Econômico**: farol ao lado da competência (`domain/validador-economico.js`). Verde = econômico do próprio
  mês e último da obra; amarelo = a planilha só repetiu um fechamento anterior e o farol mostra a competência real
  (ex.: SET/26 igual a MAI/26); azul = existe um econômico mais recente.
- "IEC" (IEC Obra) e "IEC s/ correção" em vermelho quando acima de 1 (tabela e indicadores do Econômico).
- Indicador "Variação de custo (mês)" passa a se chamar "Variação de Resultado (Sem correção)".
- **Valores monetários sem casas decimais e sem símbolo**; o "(R$)" foi para o título da coluna/caixa (Resumo
  Geral, Físico, Econômico, Painel de obras e ficha da obra). Os valores abreviados (R$ 13,5 mi) saíram.
- **Cards crescem com os valores**: indicadores, análise econômica, custos por, detalhes do item e simulação não
  cortam mais o valor com reticências; quando não cabem, quebram para a linha de baixo ou alargam a coluna.
- **Simulação sem atividades voltou a funcionar**: desde a v10 cada coluna só era simulada se as atividades
  "fechassem" com o total (±1 p.p.); na planilha atual quase nenhuma obra fecha (colunas do mês com o acumulado e
  realizado das atividades diferente do BD_Infos Gerais), e tudo ficava "—". Agora as colunas acumuladas são
  simuladas aplicando ao total oficial só o efeito da retirada (avisadas como "ajustado pela diferença"); só as
  colunas do mês que não fecham continuam "—".
- Correção: a tabela acessível dos gráficos podia esticar a página do Resumo Geral (barra de rolagem em 1366×768).

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
