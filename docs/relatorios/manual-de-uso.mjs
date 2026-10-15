/**
 * Relatório "Manual de uso": acesso, navegação, cada aba e as tarefas do Planejamento, passo a passo.
 * Edite os textos aqui e rode `node docs/relatorios/gerar.mjs`.
 */
import { pagina, tabela, telaAnotada } from './modelo.mjs';

const capitulos = [];
const cap = (id, rotulo, titulo, html) => capitulos.push({ id, titulo, html: `<section class="capitulo" id="${id}"><div class="rotulo">${rotulo}</div><h2>${titulo}</h2>${html}</section>` });

cap('acesso', 'Começando', 'Acesso e perfis', `
  <div class="cartoes">
    <div class="cartao"><span class="papel">Dev</span><h4>Acesso total</h4><p>Vê as duas apresentações, cadastra conteúdo, gerencia usuários e acompanha as fontes de dados e o INCC.</p></div>
    <div class="cartao"><span class="papel">Planejamento</span><h4>Cadastra o conteúdo</h4><p>Cadastro de obras, TxC, fotos, telas do cliente, INCC manual e o botão "Atualizar dados".</p></div>
    <div class="cartao"><span class="papel">Viewer</span><h4>Só visualiza</h4><p>Abre as apresentações Obra e Cliente, sem administração.</p></div>
  </div>
  ${telaAnotada('login', 'Tela de entrada', [
    { n: 1, titulo: 'E-mail e senha', texto: 'Cada pessoa recebe o acesso do Dev (Administração → Usuários). A senha pode ser trocada em "Minha conta" (clique no seu nome no topo).' },
    { n: 2, titulo: 'Entrar', texto: 'No primeiro uso do sistema esta tela pede para criar o usuário Dev.' },
  ])}
  <h3>Abrir o sistema no computador</h3>
  <ol class="passos">
    <li>Dê dois cliques em <code>Abrir apresentacao local.bat</code>, na pasta do projeto. Ele sobe o servidor e abre o navegador em <code>http://localhost:5210</code>.</li>
    <li>Mantenha a janela preta aberta enquanto usa a apresentação. Para encerrar, feche essa janela.</li>
    <li>Na primeira abertura do dia o servidor lê as planilhas do SharePoint (cerca de 10 segundos). Depois disso as telas abrem na hora.</li>
  </ol>
`);

cap('navegacao', 'Começando', 'Navegação e filtros', `
  ${telaAnotada('capa-obra', 'Capa da apresentação Obra', [
    { n: 1, titulo: 'Mês de referência', texto: 'Escolha o mês do fechamento. Ele vale para todas as abas.' },
    { n: 2, titulo: 'Obras ativas', texto: 'Clique para abrir a lista de obras com avanço e assertividade.' },
    { n: 3, titulo: 'Assertividade média' },
    { n: 4, titulo: 'Unidades construídas no mês', texto: 'Depende do Nº de UH no cadastro de obras.' },
    { n: 5, titulo: 'Maior assertividade do mês' },
    { n: 6, titulo: 'Atalhos', texto: 'Levam a cada aba. As abas também ficam no menu do topo.' },
  ])}
  <ol class="passos">
    <li><b>Obra ou Cliente:</b> use o botão "Obra | Cliente" no topo. A apresentação Cliente usa as colunas do cliente, esconde imagens marcadas como internas e mostra as telas extras do cliente.</li>
    <li><b>Apresentar:</b> coloca o navegador em tela cheia e esconde filtros e botões de edição. Esc ou o mesmo botão sai.</li>
    <li><b>Atualizar dados:</b> (Planejamento/Dev) relê as planilhas no SharePoint na hora, sem esperar o cache de 30 minutos.</li>
  </ol>
  ${telaAnotada('filtro-obras', 'Filtro de obras, no estilo do Excel', [
    { n: 1, titulo: 'Pesquisar', texto: 'Digite parte do nome da obra ou do cliente.' },
    { n: 2, titulo: 'Selecionar tudo / todos os resultados', texto: 'Com pesquisa, marca só o que apareceu.' },
    { n: 3, titulo: 'Cliente', texto: 'A seta recolhe; a caixa marca todas as obras do cliente.' },
    { n: 4, titulo: 'OK aplica', texto: 'Com pesquisa ativa, aplica só os resultados marcados (como no Excel). Cancelar fecha sem mudar.' },
  ])}
  <div class="nota"><b>Várias obras</b>No Resumo Geral, várias obras somam os valores em R$ e ponderam os percentuais pelo orçamento. Nas abas de uma obra só (Físico, Econômico, TxC, Fotos) aparece o seletor "Obra exibida" para escolher entre as filtradas.</div>
`);

cap('abas', 'Usando a apresentação', 'As abas', `
  <h3>Resumo Geral</h3>
  <p>Tudo em uma tela, sem rolagem: quadro CEF × Físico, análise econômica, curvas, realizado × planejado, assertividade, custos por unidade, INCC, NH-NU e andamento. "+ Infos da obra" abre a ficha completa da obra.</p>
  ${telaAnotada('resumo-geral', 'Resumo Geral', [
    { n: 1, titulo: 'Filtros', texto: 'De/Até mudam os meses dos gráficos; o mês de referência muda os quadros.' },
    { n: 2, titulo: 'CEF × Físico', texto: 'Selos verdes ▲ = adiantado, vermelhos ▼ = atrasado.' },
    { n: 3, titulo: 'Análise econômica', texto: 'Passe o mouse num valor compacto para ver o completo.' },
    { n: 4, titulo: 'Curva acumulada', texto: 'Passe o mouse no gráfico para ver os valores do mês.' },
    { n: 5, titulo: 'Realizado × planejado' },
    { n: 6, titulo: 'Assertividade' },
    { n: 7, titulo: 'Custos por UH / AE / AP / AC' },
    { n: 8, titulo: 'INCC' },
    { n: 9, titulo: 'NH-NU' },
    { n: 10, titulo: 'Andamento geral' },
    { n: 11, titulo: '+ Infos da obra' },
  ])}
  <h3>Resumo Físico</h3>
  ${telaAnotada('resumo-fisico', 'Resumo Físico', [
    { n: 1, titulo: 'Comentário e metas do mês' },
    { n: 2, titulo: 'Projeção econômica' },
    { n: 3, titulo: 'Mês de referência', texto: 'Colunas em destaque laranja.' },
    { n: 4, titulo: 'Mês seguinte' },
    { n: 5, titulo: 'Pesos' },
    { n: 6, titulo: 'Linha da obra' },
    { n: 7, titulo: 'Seta', texto: 'Mostra ou esconde as atividades filhas.' },
    { n: 8, titulo: 'Comentário', texto: 'Clique no selo para ler.' },
    { n: 9, titulo: 'Ocultar projeção e pesos', texto: 'Deixa a tabela mais limpa para a reunião.' },
  ])}
  <h3>Resumo Econômico</h3>
  ${telaAnotada('resumo-economico', 'Resumo Econômico', [
    { n: 1, titulo: 'Indicadores da obra' },
    { n: 2, titulo: 'Grupos de colunas' },
    { n: 3, titulo: 'Linha da obra' },
    { n: 4, titulo: 'Detalhe do item', texto: 'Clique na seta (ou no selo de comentário) para abrir.' },
    { n: 5, titulo: 'Comentários do item' },
    { n: 6, titulo: 'Rodapé fixo', texto: 'Continua visível enquanto você rola a tabela.' },
  ])}
  <h3>Tempo x Caminho e Acompanhamento Fotográfico</h3>
  ${telaAnotada('tempo-caminho', 'Tempo x Caminho', [
    { n: 1, titulo: 'Escolha o mês', texto: 'Só aparecem meses com imagens.' },
    { n: 2, titulo: 'Escolha a torre' },
    { n: 3, titulo: 'Navegue', texto: 'Setas na imagem ou ← → no teclado.' },
    { n: 4, titulo: 'Ampliar', texto: 'Esc para sair.' },
    { n: 5, titulo: 'Comentário' },
    { n: 6, titulo: 'Miniaturas' },
    { n: 7, titulo: 'Cadastrar', texto: 'Atalho para o cadastro (Planejamento/Dev).' },
  ])}
`);

cap('planejamento', 'Planejamento', 'Tarefas do Planejamento', `
  <h3>1. Cadastrar ou atualizar as obras</h3>
  <ol class="passos">
    <li>Administração → <b>Cadastro de obras</b>.</li>
    <li>Para várias obras de uma vez: <b>Importar planilha</b> e arraste a planilha "Painel de Obras" (mesmos cabeçalhos do Power BI). Obras existentes são atualizadas.</li>
    <li>Para uma obra: <b>Cadastrar</b>/<b>Editar</b> na linha, preencha e salve. Campos que alimentam cálculos mostram "Usado em" logo abaixo.</li>
  </ol>
  ${telaAnotada('admin-cadastro', 'Cadastro de obras', [
    { n: 1, titulo: 'Seções' }, { n: 2, titulo: 'Importar planilha' }, { n: 3, titulo: 'Nova obra' }, { n: 4, titulo: 'Editar a obra' },
  ])}
  <h3>2. Cadastrar TxC e fotos do mês</h3>
  <ol class="passos">
    <li>Administração → <b>TxC e fotos</b>, escolha "Tempo x Caminho" ou "Acompanhamento fotográfico" e clique em <b>Cadastrar imagens</b> (ou use "Cadastrar" dentro da própria aba).</li>
    <li>Escolha a obra e o mês, informe a torre (TxC) ou o local (fotos) e escreva o comentário.</li>
    <li>Arraste as imagens. Cada imagem vira um registro com os mesmos dados; a ordem segue a seleção.</li>
    <li>Desmarque "Exibir na apresentação ao cliente" para imagens internas.</li>
  </ol>
  ${telaAnotada('admin-midia-form', 'Cadastro de imagens', [
    { n: 1, titulo: 'Obra, mês, torre/local, ordem' }, { n: 2, titulo: 'Comentário' }, { n: 3, titulo: 'Arraste as imagens' }, { n: 4, titulo: 'Exibir ao cliente' },
  ])}
  <h3>3. Montar uma tela para o cliente</h3>
  <ol class="passos">
    <li>Administração → <b>Telas do cliente</b> → <b>Nova tela</b>.</li>
    <li>Dê título e ordem. Marque as obras em que a tela aparece (nenhuma marcada = todas).</li>
    <li>Adicione blocos: <b>Planilha</b> (exibida só para leitura; informe a aba se não for a primeira), <b>Imagem</b> ou <b>Texto</b>, em largura inteira ou meia.</li>
    <li>Salve e confira em "Ver". A tela aparece no menu da apresentação Cliente.</li>
  </ol>
  ${telaAnotada('admin-tela-form', 'Editor de tela do cliente', [
    { n: 1, titulo: 'Título, subtítulo e ordem' }, { n: 2, titulo: 'Bloco' }, { n: 3, titulo: 'Adicionar bloco' },
  ])}
  <h3>4. Conferir as fontes e o INCC</h3>
  <ol class="passos">
    <li>Administração → <b>Fontes e INCC</b> mostra quando as planilhas foram lidas e quantas linhas cada aba tem.</li>
    <li>O INCC-DI se atualiza sozinho pelo Banco Central. Se a FGV publicar um índice diferente, corrija o mês em "Corrigir um mês manualmente".</li>
  </ol>
`);

cap('usuarios', 'Dev', 'Usuários', telaAnotada('admin-usuarios', 'Usuários', [
  { n: 1, titulo: 'Novo usuário', texto: 'Nome, e-mail, papel (Dev, Planejamento ou Viewer) e senha inicial. Combine a senha por um canal seguro.' },
  { n: 2, titulo: 'Lista', texto: 'Editar muda papel, desativa ou redefine a senha. Usuário desativado perde o acesso na hora.' },
]));

cap('duvidas', 'Ajuda', 'Dúvidas comuns', tabela(['Situação', 'O que fazer'], [
  ['Os números não batem com a planilha', 'Clique em **Atualizar dados** (o cache é de 30 min). Confira o mês de referência no filtro.'],
  ['Aparece "Dados possivelmente desatualizados"', 'O SharePoint não respondeu; a apresentação mostra a última leitura. Tente "Atualizar dados" mais tarde.'],
  ['Custos por UH, NH-NU ou unidades do mês aparecem "—"', 'Falta Nº de UH ou áreas no cadastro da obra.'],
  ['INCC base aparece "—"', 'Preencha "INCC do orçamento base" ou a "Data-base INCC" no cadastro da obra.'],
  ['Obra não aparece no filtro', 'Ela precisa existir nas planilhas ou no cadastro de obras. Confira a grafia do nome.'],
  ['Resumo Físico demora a abrir', 'Só acontece na primeira leitura após ligar o servidor (a aba tem ~25 mil linhas).'],
  ['Sem imagens no TxC/Fotos', 'Cadastre em Administração → TxC e fotos. Na visão Cliente, confira "Exibir na apresentação ao cliente".'],
  ['Esqueci a senha', 'Peça ao Dev para redefinir em Administração → Usuários.'],
]));

export function manualDeUso() {
  return pagina({
    titulo: 'Manual de uso da apresentação',
    eyebrow: 'Planejamento e Controle',
    subtitulo: 'Como acessar, navegar pelas apresentações Obra e Cliente e manter o conteúdo (obras, TxC, fotos e telas do cliente).',
    sumario: capitulos.map((c) => [c.id, c.titulo]),
    corpo: capitulos.map((c) => c.html).join(''),
  });
}
