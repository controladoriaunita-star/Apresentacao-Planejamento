# Changelog

Cada versão só é fechada com `npm run verificar` passando.

| Ambiente | Versão |
|---|---|
| Produção | v36.4 (publicada em 25/11/2026) |
| Dev (local) | v40.2 (em validação) |

## v40.2 — 27/11/2026 — Envio da IAT/IST por e-mail: anexos grandes e confirmação na hora

- **Anexos grandes**: o Microsoft Graph recusa pedidos acima de 4 MB, e os PDFs com fotos (principalmente a IST, com
  2 PDFs) passavam disso — o e-mail não saía. Até 3 MB no total continua o `sendMail` de antes; acima, o servidor cria
  o rascunho, sobe cada PDF por **sessão de upload** (em partes) e envia (fica em Itens Enviados). Esse caminho exige a
  permissão de aplicativo **Mail.ReadWrite** além da Mail.Send; sem ela, a mensagem de erro diz qual falta.
- O token da Microsoft é reaproveitado até perto de expirar (antes era pedido a cada envio).
- **Confirmação na hora**: "Enviar por e-mail" abre direto a tela com De, Para, Cópia, Assunto e corpo, sem o aviso
  "Gerando o PDF para anexar". Os PDFs são gerados e enviados ao armazenamento enquanto o usuário confere; cada anexo
  aparece "preparando" e vira link quando fica pronto. Na IST, cada PDF sobe assim que fica pronto. "Enviar e-mail"
  mostra "Enviando…" e, se clicado antes dos anexos, envia assim que eles ficam prontos.
- As bibliotecas do PDF começam a carregar ao abrir a IAT/IST, e não no clique.
- Nada muda no conteúdo do PDF, nos destinatários, nas pendências nem no histórico de envios.
- Testes: Graph simulado (token reaproveitado, anexo grande em partes, falta de Mail.ReadWrite) e tela
  (`tests/e2e/06-envio-email.spec.cjs`, com `EMAIL_ENVIO=arquivo`).

## v40.1 — 26/11/2026 — Papel Segurança cadastra os e-mails das obras

- Segurança do Trabalho ganhou o botão **E-mails das obras**: lista das obras (com busca) e a contagem de e-mails de
  cada uma; "Cadastrar e-mails" abre o mesmo diálogo do Cadastro de obras. Assim o papel **Segurança**, que não abre o
  Cadastro de obras, mantém quem recebe a IAT e a IST em cópia.
- `PUT /api/obras/cadastro/:id/emails` passa a exigir `editarSeguranca` (Dev, Planejamento e Segurança) em vez de
  `editarConteudo` (Dev e Planejamento). `GET /api/seguranca/obras` devolve também `emails`.
- O diálogo de e-mails saiu de `pages/admin-cadastro.js` para `ui/emails-obra.js` (o Cadastro de obras não muda).
- Testes: API (Segurança grava, Viewer não) e tela (papel Segurança cadastra um e-mail). Sem mudança de banco.

## v40 — 26/11/2026 — Segurança do Trabalho: Pirâmide de Bird, quase acidentes, IAT e IST

Traz para o app as versões v23 a v26 do módulo Segurança do Trabalho feitas à parte (repositório
`lucaspinheirost-jpg/Apresentacao-Planejamento`, que numerava as versões a partir da v22). Nada do que já existia
mudou além do necessário para encaixar.

- **Pirâmide de Bird** como primeiro botão do Dashboard Segurança (`pages/piramide-bird.js`), com os níveis da Unità
  (FT grave · CPT + SPT lesão leve · TRJ dano material · QA quase acidente) e cores próprias por classificação.
- **De-para de obras com busca** na importação (`ui/busca-obra.js`, `ui/busca-lista.js`), gravado de uma vez; de-para
  em branco importa com o nome da planilha (`obraPlanilha`).
- **Quase acidentes** (tipo QA, 14 categorias padronizadas) e importação da aba Base Consolidada. Não entram nos
  totais nem nos gráficos de acidentes, só na base da pirâmide.
- **IAT, IAT Metrocasa e IST** (botões Nova IAT / Nova IST e sub-abas Ocorrências · IAT · IST), com tabelas do eSocial,
  PDF gerado no navegador (html2canvas + jsPDF em `public/vendor`) e **envio pelo servidor** (`server/email/envio.mjs`,
  `EMAIL_ENVIO` = `graph`, `smtp` ou `arquivo` — ver `.env.example`). O botão "Novo acidente" passa a "Nova Ocorrência".
- **Cadastro de obras → Cadastrar e-mails** (`PUT /api/obras/cadastro/:id/emails`): cópia dos envios de IAT/IST.
- `npm run exemplo` grava a carga de exemplo da planilha de acidentes quando `data/exemplo` está vazia;
  `npm run exemplo:carga` recria.
- Encaixe no app atual: as rotas de IAT/IST usam a capacidade `editarSeguranca` (como o resto da Segurança, então o
  papel Segurança também acessa); as telas leem as obras por `estado.cadastros()` e `GET /api/seguranca/obras` passa a
  devolver também `engenharia` (Engenheiro Residente da IAT). Os filtros de acesso por obra (v26 deste app) seguem
  valendo nas consultas de acidentes.
- Supabase: rodar **`007_quase_acidentes.sql`** e **`008_informativos.sql`** (no outro repositório eram 004 e 005,
  números que aqui já estavam em uso) antes de publicar.

## v39 — 26/11/2026 — Colunas "Sem correção" de volta no Econômico do Cliente

- Resumo Econômico na apresentação **Cliente**: as colunas **Resultado s/ correção** e **IEC s/ correção** voltam a
  aparecer (estavam ocultas por regra fixa desde a v28). Agora entram em **"Colunas do cliente"** (Dev), no grupo
  "Sem correção", e podem ser ocultadas como as demais — na tela e no PDF. Na Obra nada muda.
- `domain/colunas-ocultas.js` e `pages/resumo-economico.js`; testes de domínio e de tela atualizados.

## v36.4 — 25/11/2026 — TxC e fotos: filtros e exclusão em lote

- Administração → TxC e fotos: filtros por **obra** e por **mês** (nas duas abas, Tempo x Caminho e
  Acompanhamento fotográfico), com a contagem de imagens exibidas.
- Caixas de seleção em cada imagem e "selecionar todas" (da lista filtrada) com o botão **Excluir selecionadas**.
  Só exclui o que está visível no filtro atual; usa a mesma exclusão de antes, imagem por imagem.

## v36.3 — 25/11/2026 — Clientes com e-mail de qualquer domínio

- Usuário com tipo de login **Senha do app** (clientes) pode ser cadastrado com e-mail de qualquer domínio.
  `DOMINIO_EMAIL` passa a valer só para **Conta Microsoft** (que precisa existir no 365) e para o primeiro acesso.

## v36.2 — 25/11/2026 — Link do e-mail direto para o app

- O link dos e-mails do 365 (convite e nova senha) vai **direto ao app** (`#token_hash=…&type=…`), sem passar pelo
  `/auth/v1/verify` do Supabase. O token de uso único só é gasto quando a pessoa clica em "Salvar senha e entrar"
  (`POST /auth/v1/verify` com `token_hash`). Antes, os leitores de link do Outlook/antivírus abriam o link antes da
  pessoa e o queimavam ("link expirou"), e o retorno dependia da lista de Redirect URLs do Supabase.
- Links antigos (`#access_token=…`) continuam funcionando. Supabase sem link no `generate_link` vira erro claro em
  vez de "Pedido enviado" sem e-mail.

## v36.1 — 25/11/2026 — Diagnóstico dos e-mails de acesso

- `GET /api/saude` informa `emails`: `"365"` (com `EMAIL_REMETENTE`) ou `"supabase"` — mostra na hora por onde a
  produção está enviando.
- Os e-mails enviados pelo 365 ficam com cópia em **Itens Enviados** da caixa remetente.
- Log de cada pedido (Vercel → Logs, `[e-mail de acesso]`, e-mail mascarado): enviado pelo 365, entregue ao Supabase
  ou ignorado (sem cadastro, inativo ou conta Microsoft), e o erro do 365 quando falha.

## v36 — 25/11/2026 — E-mails de acesso dos clientes pelo Microsoft 365

- **"Esqueci minha senha", convite e "Reenviar e-mail de acesso"** passam a sair pelo Microsoft 365, da caixa
  `EMAIL_REMETENTE` (Microsoft Graph, mesmo registro do Entra ID do SharePoint, permissão `Mail.Send`). Antes o
  Supabase enviava, mas sem SMTP próprio só entregava aos membros do projeto — o e-mail não chegava aos clientes.
- O Supabase só gera o link (`/auth/v1/admin/generate_link`); o link continua voltando ao app para criar a senha.
- E-mail em português, com a marca da Unità (`server/auth/correio.mjs`). Falha no envio dá mensagem clara; ao
  criar usuário, o cadastro fica salvo e o Dev reenvia depois.
- **Liga só com `EMAIL_REMETENTE`**: sem a variável tudo segue como na v35. Passos em `docs/SUPABASE_VERCEL.md`.
- Testes: `tests/api/email-365.test.mjs` (Supabase e Graph simulados).

## v35 — 25/11/2026 — Login com a conta Microsoft (Office 365)

- **Equipe entra com a conta Microsoft**: botão "Entrar com a conta Microsoft" na tela de login (OpenID Connect,
  feito todo no servidor, sem biblioteca — `server/auth/microsoft.mjs`). Usa o registro do Entra ID que o app já
  tem (`MS_GRAPH_*`; `ENTRA_*` opcionais). Só entra quem está cadastrado e ativo no app com o mesmo e-mail; conta
  de outra organização é recusada. A sessão continua sendo o cookie `sessao` do app (12 h).
- **Clientes continuam com senha**: novo campo **Tipo de login** em Administração → Usuários — *Conta Microsoft*
  (padrão, inclusive para todos os usuários atuais) ou *Senha do app* (quem não tem conta no 365). Com o login
  Microsoft ligado, a conta Microsoft não entra com senha, não recebe convite nem "esqueci minha senha" e "Minha
  conta" não troca senha. Criar usuário Microsoft não envia convite.
- **Dentro do Portal Unità**: a Microsoft não abre em iframe, então o login abre num pop-up e o app entra sozinho
  no iframe (verificador sorteado pelo iframe + pedido no Storage, uso único, 10 min — um link forjado não serve).
- **Liga só com `AUTH_MODE=entra`**: sem a variável, tudo funciona exatamente como na v34. Ordem segura de ativação
  e como voltar atrás em `docs/SUPABASE_VERCEL.md`.
- **Migration 006** (`perfis.login`, padrão `'microsoft'`): só acrescenta a coluna; nenhum dado muda.
- Testes: `tests/api/login-microsoft.test.mjs` (local e Supabase, Microsoft simulada — redirect, pop-up, erros,
  regras de senha e de convite); o servidor de teste ignora `AUTH_MODE` da Vercel para o build não quebrar.

## v34 — 19/11/2026 — Dev oculta colunas do Físico e do Econômico no Cliente

- **Dev — "Colunas do cliente"**: botão no Resumo Físico e no Resumo Econômico, só para o Dev e só na apresentação
  Cliente. Abre a lista de colunas agrupada como no cabeçalho; as desmarcadas ficam ocultas para o cliente, na tela
  e no **PDF** (que monta os resumos com as mesmas funções da tela). Na Obra aparecem todas. Cada tabela mantém ao
  menos uma coluna visível; vale para todas as obras.
- No Físico a faixa de grupos do cabeçalho passa a ser calculada pelas colunas visíveis (antes os grupos tinham
  tamanho fixo de 3, 8, 4 e 2 colunas). As colunas "Sem correção" do Econômico continuam ocultas no Cliente por
  regra fixa (v28) e não entram na lista.
- `PUT /api/layouts/colunas-ocultas` (só Dev) e `colunasOcultas` em `/dados/resumo` (documento `colunas-ocultas`
  no armazém, sem migration) — `domain/colunas-ocultas.js`, `ui/editor-colunas-ocultas.js`.
- Testes: domínio, contrato da rota, tela (oculta no Cliente e a Obra continua completa) e PDF sem as colunas.

## v33 — 17/11/2026 — PDF na ordem das abas da apresentação

- Exportar PDF: as seções (lista da janela, sumário da capa e folhas) saem na **mesma ordem das abas definida em
  "Editar layout"** — antes saíam sempre na ordem padrão, com as telas extras no fim. A capa continua primeiro.
- Teste de tela novo: ordem salva diferente da padrão (tela extra primeiro, Econômico antes do Geral) e o PDF
  segue essa ordem.

## v32 — 17/11/2026 — Capa do PDF sem os quadros de indicadores

- Capa do PDF: os três quadros de indicadores (Avanço físico realizado, Planejado acumulado e Desvio) ficam
  ocultos por enquanto. A capa mantém logo, cliente, obra, mês de fechamento e o sumário. Para voltar, basta
  `INDICADORES_NA_CAPA = true` em `pages/exportar-pdf.js`.

## v31 — 17/11/2026 — Fontes dos gráficos e escala por quadro

- Resumo Geral: eixos X e Y dos três gráficos maiores e em **negrito**; rótulos de dados maiores (85% da fonte do
  gráfico, antes 70%) e em negrito. Quando o rótulo não cabe deitado, fica em pé no tamanho cheio (antes caía para
  9 px); se em pé ele passaria do topo do quadro, vai dentro da barra, em branco.
- Dev: botões **A− / % / A+** em cada quadro do Resumo Geral (ao passar o mouse, ao lado do título, como o
  "Detalhe") mudam a fonte só daquele quadro, de 60% a 160% em passos de 10%; clicar no % volta a 100%. Grava na
  hora (`PUT /api/layouts/escalas-fonte`), vale para todas as apresentações e para o PDF. Ao aumentar, a fonte
  cresce até onde o conteúdo cabe no quadro; nos gráficos o espaço de cada mês continua limitando os meses.

## v30 — 16/11/2026 — PDF do Resumo Geral com o layout da tela

- O PDF do Resumo Geral volta a sair **exatamente com o layout desenhado em "Editar layout"** (mesmas posições e
  tamanhos na grade de 24 × 24, na página A4 paisagem). Sai a disposição própria da A4 da v28 (`LAYOUT_IMPRESSAO`).
  Continuam valendo os ajustes de gráficos (meses sem inclinar, eixo até o maior valor + 15%) e a fonte global.
- PDF: os gráficos do Resumo Geral ocupavam só parte do quadro (cerca de 2/3) quando o layout tem colunas estreitas
  — a página é montada maior e reduzida para caber na A4, e o gráfico ficava com o tamanho de antes. Agora cada
  gráfico é redesenhado já no tamanho final do quadro antes de virar imagem, e a redução é aplicada depois.
- PDF com a **proporção da tela**: a grade saía com a proporção da folha A4 (≈ 1,56 : 1), mais alta que a tela
  (≈ 2 a 2,5 : 1), e tudo ficava esticado na vertical. Agora usa a proporção que o Resumo Geral teve na tela (a da
  última vez que apareceu; sem isso, a estimada para a janela atual — `proporcaoNaTela` em `pages/resumo-geral.js`):
  ocupa a largura da página.
- **Folha própria para o Resumo Geral**: a página dele tem a largura da A4 paisagem (297 mm) e a altura exata da
  grade + margens (`@page resumo-geral`, gerada em `regrasPagina`) — ocupa a folha inteira sem esticar os
  quadros e sem sobra embaixo. As outras páginas continuam A4 paisagem (o Chrome/Edge gera PDF com folhas de
  tamanhos diferentes).
- PDF sem quadros cortados depois da redução da página: o ajuste da fonte deixa ~6% de folga (o texto reduzido
  quebra um pouco diferente), e as notas pequenas e os complementos dos títulos acompanham a fonte global. A
  redução passou a ser calculada com a largura realmente montada.
- Teste do PDF: confere que cada quadro sai na mesma posição da grade do layout salvo, que a grade tem a proporção
  da tela e que cada gráfico ocupa o quadro inteiro.

## v29 — 16/11/2026 — Detalhe dos gráficos, galeria, nomes de colunas e comentários (Dev) e responsividade

- **Detalhe dos gráficos (Resumo Geral)**: botão "Detalhe" ao lado do título de cada gráfico abre o gráfico em tela
  cheia com, à esquerda, a tabela das curvas mês a mês (rola na vertical; o mês de referência fica destacado e
  visível). Fecha com Esc ou "Fechar". Some no PDF e na edição do layout (`ui/detalhe-grafico.js`).
- **Galeria (TxC e fotos)**: a imagem sempre aparece inteira no palco, ajustada ao espaço (antes, imagens grandes
  saíam cortadas). Em "Ampliar" dá para ir à anterior/próxima (setas e ← →) sem fechar, e o botão "Zoom" (ou
  duplo clique no ponto) amplia para ver detalhes, arrastando para mover. Ao fechar, a página fica na última
  imagem vista (`pages/galeria.js`).
- **Dev — nomes das colunas**: botão "Nomes das colunas" no Resumo Físico e no Econômico abre a lista de colunas e
  grupos com o nome original e o atual; vazio ou "Original" volta ao original. Vale para Obra, Cliente e PDF. Os
  grupos com o mês (ex.: MAR/26) não são renomeáveis. `PUT /api/layouts/nomes-colunas` e `nomesColunas` em
  `/dados/resumo` (documento `nomes-colunas` no armazém, sem migration) — `domain/nomes-colunas.js`,
  `ui/editor-nomes-colunas.js`.
- **Dev — comentários por tela**: botão "Comentários" na barra de filtros abre um painel com as anotações da obra,
  do mês de referência e da tela atuais. O Dev escreve e apaga; o Planejamento só lê; o Viewer não vê e nada vai
  para o PDF. Com várias obras no filtro, pede uma obra só. `GET/POST/DELETE /api/comentarios-telas` (um documento
  por obra e mês no armazém, sem migration) — `domain/comentarios-telas.js`, `ui/comentarios-telas.js`,
  `server/routes/comentarios.mjs`.
- **Responsividade como regra do app** (`docs/RESPONSIVIDADE.md`, conferida pelo teste
  `tests/e2e/05-responsividade.spec.cjs` em 7 tamanhos de tela, do celular ao 2560 px):
  - Cabeçalho: até 1600 px os botões ficam só com o ícone; quando as abas não cabem, descem para uma linha
    própria (e quebram se preciso) — antes, de 1024 a 1536 px, abas sumiam cortadas. No celular o cabeçalho
    deixava as abas inacessíveis e a página rolava para o lado.
  - Galeria: em tela cheia a imagem saía cortada embaixo (1280–1536 px); agora sempre inteira. Painel lateral
    só desce para baixo da foto abaixo de 900 px.
  - Resumo Geral: textos nunca abaixo de 10 px; eixo dos gráficos até o maior valor + 15% (antes saltava para
    200% e os dados usavam metade da altura); em gráfico muito baixo os rótulos de valor somem (o Detalhe mostra
    a tabela); fonte dos gráficos até 20 px em telas grandes; grade com altura mínima de 500 px (1280×720 rola um
    pouco; do 1366×768 para cima continua sem rolagem); abaixo de 1100 px, quadros em 2 colunas.
  - Físico/Econômico: títulos de grupo quebram linha em vez de cortar; até 1600 px letra 12,5 px e a tabela
    rola dentro do quadro (valores nunca encostam).
  - Resumo Geral na primeira carga: os quadros eram ajustados antes de as fontes da página chegarem e ficavam
    cortados (ex.: Análise econômica 121 px maior que o quadro); agora reajustam quando as fontes carregam. Era a
    causa das falhas intermitentes dos testes do Resumo Geral.
  - Celular: rodapé congelado do Econômico vira bloco no fim da página (empilhado, cobria a tabela).
  - Windows × Mac: gráficos com fonte de reserva do sistema e redesenhados quando as fontes carregam; capa com
    rótulos em até 2 linhas em vez de reticências; textos de 10 px passaram a 11 px.
- **Ajustes após a validação do preview:**
  - Fotos: nunca ampliadas além do tamanho real (`object-fit: scale-down`) — fotos menores que o palco apareciam
    esticadas, "com zoom". Continuam inteiras quando são maiores.
  - Resumo Geral com **fonte global**: um tamanho só para todos os quadros de valores, títulos dos quadros e textos
    dos gráficos — o maior com que todos cabem (`--fonte-rg`, `ajustarQuadros` em `pages/resumo-geral.js`; vale
    também no PDF). Máximo na tela 18 px. Rótulos de valor dos gráficos a 70% dessa fonte.
  - "Custos por": os valores nunca saem dos fundos — o ajuste da fonte também confere cada caixa (antes só o quadro).
- Testes: `tests/domain/nomes-comentarios.test.mjs`, contrato das rotas novas, testes de tela do Detalhe, da
  galeria em tela cheia, dos nomes das colunas e dos comentários, e o teste de responsividade.

## v28 — 16/11/2026 — colunas iguais nos resumos e ordem das abas

- **Resumo Econômico**: ocultos por enquanto os indicadores do topo (Avanço, Custo lançado… % contratado) e o farol
  "Repete o econômico / Competência real" (constante `MOSTRAR_TOPO` em `pages/resumo-economico.js`; o rodapé continua).
- **Resumo Econômico — apresentação Cliente**: colunas do grupo **Sem correção** (Resultado s/ correção e IEC s/
  correção) ocultas por enquanto, na tela e no PDF; as outras 7 dividem a largura (`GRUPOS_OCULTOS_CLIENTE` em
  `pages/resumo-economico.js`). Na Obra continuam todas.
- **Resumo Geral**: quadro **NH-NU** oculto por enquanto, na tela e no PDF (`QUADROS_OCULTOS` em
  `domain/layout-resumo.js`). Quadro oculto não conta na sobreposição: em "Editar layout" os vizinhos podem
  ocupar o espaço dele. O retângulo do NH-NU fica guardado; se ao voltar ele cobrir outro quadro, o layout
  salvo volta ao padrão.
- **Resumo Físico e Econômico**: todas as colunas de valores com a mesma largura (coluna Item/Serviço com largura
  própria), títulos quebram linha e valores centralizados (`.colunas-iguais` em `css/paginas.css`). Abaixo da largura
  mínima a tabela rola na horizontal; no Físico cabe inteira numa tela de 1920 px.
- **Resumo Físico**: as colunas de **Pesos** (Peso atraso e Peso planejado) ficam sempre visíveis; o botão passa a
  ser "Ocultar/Exibir projeção econômica".
- **Ordem das abas do menu**: no Resumo Geral, com **"Editar layout"** ligado, o Dev arrasta as abas do menu superior
  (inclusive as Novas telas) para mudar a ordem; teclado: Alt + ← / →. "Cancelar" desfaz, "Restaurar padrão" volta à
  ordem do app e "Salvar para todas as apresentações" grava junto com o layout (vale para Obra e Cliente). Abas novas
  entram no fim. Fora da edição as abas não arrastam.
  - `PUT /api/layouts/abas` (só Dev) e `ordemAbas` em `GET /api/dados/resumo`; documento `ordem-abas` no armazém
    (arquivo local ou Storage `sistema/` no Supabase — **sem migration**).
  - Arquivos: `domain/ordem-abas.js` (puro, testado), `ui/ordenar-abas.js`, `main.js`, `pages/resumo-geral.js`,
    `ui/editor-layout.js` (`aoRestaurarPadrao`), `server/routes/dados.mjs`, `css/layout.css`. Nenhum cálculo mudou.
- **PDF — Resumo Geral com disposição própria para a A4** (não segue mais o layout do Dev, feito para a tela):
  CEF × Físico e Análise econômica à esquerda, os três gráficos largos e empilhados à direita e a faixa
  Custos por · INCC · Andamento geral embaixo, sem espaços vazios (`LAYOUT_IMPRESSAO` em `domain/layout-resumo.js`).
- **Gráficos do Resumo Geral (tela e PDF)**: a fonte dos eixos também cabe no espaço de cada mês (até 8 px) e os
  meses nunca inclinam — antes, num gráfico estreito com muitos meses, os meses inclinavam e se sobrepunham. Os
  rótulos de dados usam uma fonte que cabe na horizontal entre dois pontos (`ui/graficos.js`).
- PDF: o ajuste dos quadros só mede depois que as fontes da página carregaram (antes, a troca de fonte depois da
  medida podia cortar quadros — falha intermitente do teste do PDF).
- Testes: `tests/domain/ordem-abas.test.mjs`, contrato da rota nova e teste de tela do arrastar; o teste do rodapé
  congelado usa janela de 500 px (sem os indicadores do topo a página cabe em 600 px).

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
