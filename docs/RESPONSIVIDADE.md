# Responsividade — regra do app (v29)

O app precisa ficar na melhor formatação disponível em qualquer tela (Windows ou Mac, notebook, monitor,
telão ou celular), sempre priorizando a leitura clara dos dados. Toda mudança de tela segue estas regras, e o
teste `tests/e2e/05-responsividade.spec.cjs` as confere em 7 tamanhos (390×844, 1024×768, 1280×720, 1366×768,
1440×900, 1920×1080 e 2560×1440) nas telas Início (Obra e Cliente), Resumo Geral, Físico, Econômico e Fotos.

## As regras

1. **A página nunca rola para o lado.** O que for largo (tabelas) rola dentro do próprio quadro, com a primeira
   coluna fixa. Valores nunca encostam uns nos outros: se a coluna não comporta o número, a tabela rola.
2. **Todas as abas do menu ficam visíveis.** Até 1600 px os botões do cabeçalho mostram só o ícone (o nome fica no
   `title`). Quando as abas não cabem ao lado do logo, elas descem para uma linha própria e quebram em quantas
   linhas forem precisas (`ajustarCabecalho` em `main.js`, classe `.duas-linhas`). A altura dessa área entra em
   `--topo-h` (tokens.css): use `var(--topo-h)` — nunca `--header-h` — para descontar o cabeçalho da altura da tela.
3. **Nenhum texto da página abaixo de 10 px** (rótulos de dados dos gráficos: 9 px na tela). Tamanhos relativos
   (`em`) dentro de quadros que encolhem levam piso: `font-size: max(10px, 0.85em)`.
4. **Imagens sempre inteiras** (`object-fit: contain`) — o zoom é uma ação do usuário, nunca o padrão.
5. **Gráficos**: a fonte acompanha o tamanho do gráfico e o espaço de cada mês (8–20 px); os meses não
   inclinam; o eixo vai até o maior valor + 15%; em gráfico muito baixo os rótulos de valor somem (o "Detalhe"
   mostra a tabela). Fonte com reserva do sistema e redesenho quando as fontes carregam.
6. **Resumo Geral numa tela, sem rolagem**, do 1366×768 para cima. Em telas mais baixas a grade não fica menor
   que 500 px de altura (rola um pouco). Abaixo de 1100 px de largura, os quadros ficam em 2 colunas e os
   gráficos na largura toda; no celular, um abaixo do outro.
7. **Celular (≤ 760 px)**: margens de 16 px, cabeçalho sem "Apresentar", rodapés que seriam congelados viram
   blocos normais no fim da página.

## Windows × Mac

A diferença mais comum é a fonte: Inter e Sora vêm do Google Fonts. Se não carregarem (rede bloqueada) ou
antes de carregar, cada sistema usa a sua fonte (Segoe UI no Windows, SF no Mac), com larguras diferentes. Por
isso nada depende de largura exata de texto (sem `nowrap` com reticências em dados; títulos quebram linha),
os gráficos usam a mesma pilha de fontes com reserva e são redesenhados quando as fontes carregam, e o PDF só
mede os quadros depois das fontes.

## Ao criar ou mudar uma tela

- Rode `npm run verificar` (inclui o teste de responsividade).
- Se a tela é nova, inclua a rota em `ROTAS` no `05-responsividade.spec.cjs`.
- Confira pelo menos 1366×768, 1440×900 e 1920×1080; tabelas também em 1280×720.
