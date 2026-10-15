/**
 * Relatório "Funcionalidades e origem dos dados": cada tela com pontos numerados e, para cada ponto,
 * o que é, de onde vem (aba/coluna) e como é calculado. Edite os textos aqui e rode
 * `node docs/relatorios/gerar.mjs` para regerar o HTML.
 */
import { pagina, tabela, telaAnotada } from './modelo.mjs';

const IG = 'aba `BD_Infos Gerais` (item Geral, mês de referência)';
const EC = 'aba `BD_Econômico` (item Geral, mês de referência)';

const capitulos = [];
const cap = (id, rotulo, titulo, html) => capitulos.push({ id, titulo, html: `<section class="capitulo" id="${id}"><div class="rotulo">${rotulo}</div><h2>${titulo}</h2>${html}</section>` });

cap('fontes', 'Visão geral', 'De onde vêm os dados', `
  <p>A apresentação lê quatro abas de uma planilha no SharePoint pelo Microsoft Graph e completa com informações cadastradas no próprio app. Nada é calculado no servidor: ele só entrega as planilhas, e os cálculos (as medidas que existiam no Power BI) rodam no navegador, no código de <code>public/js/domain</code>.</p>
  ${tabela(['Fonte', 'O que traz', 'Como chega', 'Atualização'], [
    ['`BD_Infos Gerais`', 'Curvas físicas mês a mês por obra (previsto, replanejado, realizado, metas, CEF/Banco), assertividade, homens/mês, comentários e principais metas', 'Graph: `drives/{drive}/items/{item}/workbook/worksheets(\'BD_Infos Gerais\')/usedRange`', 'Cache de 30 min no servidor; botão **Atualizar dados** relê na hora'],
    ['`BD_Físico por atividade`', 'Mesmas curvas por item da EAP (pai e filho), pesos e comentários por atividade (~25 mil linhas)', 'Graph, aba `BD_Físico por atividade`; o navegador recebe só a obra aberta', 'Pré-carregada quando o servidor inicia; mesmo cache'],
    ['`BD_Orc`', 'Orçamento base físico por item e total (ITEM = Geral) e descrição dos itens', 'Graph, aba `BD_Orc`', 'Mesmo cache'],
    ['`BD_Econômico`', 'Custos, saldos, projeção, resultado, IEC, aditivos e comentários por item e mês', 'Graph, aba `BD_Econômico`', 'Mesmo cache'],
    ['Cadastro de obras (no app)', 'Nº de UH, áreas, INCC base, prazos, equipe, endereço, situação', 'Administração → Cadastro de obras (ou importação da planilha "Painel de Obras")', 'Na hora em que o Planejamento salva'],
    ['INCC-DI', 'Número-índice mês a mês', 'Histórico FGV (1994–ago/2026) + Banco Central, série SGS 192 (variação % mensal)', 'Automático 1× por dia; correção manual em Fontes e INCC'],
    ['TxC, fotos e telas do cliente', 'Imagens, planilhas e textos', 'Administração (upload) — ficam no servidor, fora do SharePoint', 'Na hora'],
  ])}
  <div class="nota"><b>Junção entre as abas</b>As abas são ligadas pelo <b>nome da obra</b>, ignorando maiúsculas, acentos e espaços ("MetroCasa" = "Metrocasa"). O BD_Econômico não tem o Nº da obra UAU, por isso o nome é a chave.</div>
  <div class="nota"><b>Mês de referência</b>As planilhas trazem 36 meses por obra, inclusive os futuros. O mês de referência padrão é o último mês em que alguma obra filtrada teve <code>Realizado Mês</code> &gt; 0, sem passar do mês atual. Pode ser trocado no filtro.</div>
  <h3>Visão Obra × visão Cliente</h3>
  <p>A apresentação Cliente usa as colunas "- Cliente" da planilha no lugar das "- Obra". O resto (metas, realizado, valores econômicos) é igual.</p>
  ${tabela(['Informação', 'Visão Obra', 'Visão Cliente'], [
    ['Previsto original', '`Previsto Original Acumulado/Mês - Obra`', '`Previsto Original Acumulado/Mês - Cliente`'],
    ['1º replanejado', '`1º Replanejado Acumulado/Mês - Obra`', '`1º Replanejado Acumulado/Mês - Cliente`'],
    ['Planejado atual', '`Replanejado Atual Acumulado/Mês - Obra`', '`Replanejado Atual Acumulado/Mês - Cliente`'],
    ['Comentário do mês', '`Comentário Obra`', '`Comentário Cliente`'],
    ['Principais metas', '`Principais Metas Obra`', '`Principais metas Cliente`'],
    ['Comentário por atividade', '`Comentários - Obra`', '`Comentários - Cliente`'],
    ['Peso de atraso', '`Peso Atraso / Adiantamento`', '`Peso Atraso / Adiantamento Cliente`'],
  ])}
`);

cap('capa', 'Aba Início', 'Capa (Início)', telaAnotada('capa-obra', 'Início (apresentação Obra)', [
  { n: 1, titulo: 'Mês de referência', texto: 'Muda o mês de todos os indicadores da capa e das outras abas.', origem: 'meses existentes em `BD_Infos Gerais`' },
  { n: 2, titulo: 'Obras ativas', texto: 'Clique para ver a lista com avanço e assertividade de cada obra.', origem: IG + ' + Situação do cadastro de obras', calculo: 'obra com `Realizado Mês` > 0 nos últimos 3 meses e `Realizado Acumulado` < 100%. A Situação do cadastro (ativa/concluída/paralisada) prevalece.' },
  { n: 3, titulo: 'Assertividade média da empresa', origem: '`Assertividade` em ' + IG, calculo: 'média simples entre as obras que fecharam o mês (Realizado Mês > 0). O Power BI dividia pelo total de obras, contando as sem fechamento como zero.' },
  { n: 4, titulo: 'Unidades construídas no mês', origem: '`Nº de UH` (cadastro) e `Realizado Mês` (' + IG + ')', calculo: 'Σ Nº de UH × Realizado Mês das obras ativas. Obras sem Nº de UH no cadastro ficam de fora (o cartão avisa quantas).' },
  { n: 5, titulo: 'Obra com maior assertividade no mês', origem: '`Assertividade` em ' + IG },
  { n: 6, titulo: 'Atalhos para as abas', texto: 'Na visão Cliente aparecem também as telas criadas pelo Planejamento.' },
]) + telaAnotada('capa-cliente', 'Início (apresentação Cliente)', [
  { n: 1, titulo: 'Obra apresentada', texto: 'A capa do cliente mostra uma obra só; não há indicadores da empresa.' },
  { n: 2, titulo: 'Avanço físico realizado', origem: '`Realizado Acumulado` em ' + IG },
  { n: 3, titulo: 'Planejado acumulado', origem: '`Replanejado Atual Acumulado - Cliente` em ' + IG },
  { n: 4, titulo: 'Desvio', calculo: 'Realizado acumulado − Planejado acumulado (positivo = adiantado).' },
  { n: 5, titulo: 'Troca Obra / Cliente', texto: 'Muda a apresentação inteira para as colunas "- Cliente" e mostra as telas do cliente no menu.' },
]));

cap('filtros', 'Todas as abas', 'Filtros estilo Excel', telaAnotada('filtro-obras', 'Filtro de obras aberto', [
  { n: 1, titulo: 'Pesquisa', texto: 'Filtra a lista pelo nome da obra ou do cliente, sem diferenciar acentos.' },
  { n: 2, titulo: '(Selecionar tudo / todos os resultados)', texto: 'Com pesquisa ativa, marca só os resultados — e o OK aplica só eles, como no Excel.' },
  { n: 3, titulo: 'Grupo por cliente', texto: 'A seta recolhe/expande; a caixa marca todas as obras do cliente.', origem: 'coluna `Cliente` de `BD_Infos Gerais` / `BD_Orc` (ou do cadastro)' },
  { n: 4, titulo: 'Contagem, Cancelar e OK', texto: 'Os filtros de mês (De, Até, Mês de referência) usam o mesmo componente, agrupados por ano.' },
]));

cap('resumo-geral', 'Aba Resumo Geral', 'Resumo Geral', `
  <p>Com várias obras no filtro, os percentuais são média ponderada pelo orçamento base físico de cada obra e os valores em R$ são somados (o Power BI mostrava o maior valor entre as obras). A página ocupa exatamente a altura da tela; em telas baixas os valores da análise econômica aparecem compactos (R$ 13,5 mi).</p>
  ${telaAnotada('resumo-geral', 'Resumo Geral', [
    { n: 1, titulo: 'Filtros', texto: '**De / Até** = meses mostrados nos gráficos. **Mês de referência** = mês dos quadros e da linha vertical tracejada dos gráficos.' },
    { n: 2, titulo: 'Quadro CEF × Físico', origem: IG + ' — colunas "Banco 1ª Fase" (CEF) e curvas da obra (Físico)', calculo: '**Mês de referência** — Avanço mês: CEF `Realizado/Projetado Mês - Banco 1ª Fase`, Físico `Realizado Mês`; Avanço acm: `Realizado/Projetado Acumulado - Banco 1ª Fase` / `Realizado Acumulado`; Cronograma: `Cronograma Acumulado - Banco 1ª Fase` / `Previsto Original Acumulado - Obra`; Previsto (rep1): `Previsto Acumulado - Banco 1ª Fase` / `Replanejado Atual Acumulado - Obra`; Desvio = Avanço acm − Previsto. **Mês seguinte** — CEF: as mesmas colunas do mês seguinte; Físico: Projetado mês = `Meta Mês - Mês Subsequente`, Projetado acm = `Meta Acumulada - Mês Subsequente` (do mês de referência), Cronograma e Previsto do mês seguinte; Desvio = Projetado acm − Previsto. Obra sem curva CEF: CEF zerado.' },
    { n: 3, titulo: 'Análise econômica', origem: EC + ' e `BD_Orc` (ITEM = Geral)', calculo: 'Orçado = `Orçamento Base Físico` (BD_Orc, Geral) · Projetado = `Custo Projetado Total` · Desvio R$ = Orçado − Projetado · IEC = `IEC Obra` · % de indireto = Custo Projetado do **item 16** ÷ do Geral · Custo pago e a pagar = `Custo Pago` + `NFs Lançadas` · Saldos = `Saldos OC` + `Saldos Contratos` · Orç. de término = `Orçamento de Término` · Passível de reajuste = `Custo Passível de Reajuste` · Aditivos aprovados = `Total de Aditivos` − `Aditivos sem Aprovação` · Custos não incidentes = `Custos Fora Contrato`.' },
    { n: 4, titulo: 'Curva acumulada atual × original', origem: IG + ', mês a mês', calculo: 'Previsto original (tracejado) = `Previsto Original Acumulado`; Realizado = `Realizado Acumulado` até o mês de referência; Planejado atual = `Replanejado Atual Acumulado`. A sequência repetida no fim da série (100%, 100%…) é cortada, como as medidas "Sem Repetição" do Power BI.' },
    { n: 5, titulo: 'Realizado × planejado (mês)', origem: '`Realizado Mês` e `Replanejado Atual Mês` (' + IG + ')' },
    { n: 6, titulo: 'Assertividade', origem: 'coluna `Assertividade` de `BD_Infos Gerais`, até o mês de referência' },
    { n: 7, titulo: 'Custos por (sem correção)', origem: 'cadastro de obras (UH e áreas), `BD_Orc` e ' + EC, calculo: '(Orçado − `Resultado Sem Correção`) ÷ Nº de UH, Área equivalente, Área privativa total e Área construída.' },
    { n: 8, titulo: 'INCC', origem: 'cadastro (`INCC do orçamento base` ou data-base) + série INCC-DI (FGV/Banco Central)', calculo: '% reajuste = índice do mês de referência ÷ índice base − 1. O Power BI fazia base ÷ mês (resultado invertido).' },
    { n: 9, titulo: 'NH-NU', origem: '`Homens/ mês` (' + IG + ') e Nº de UH (cadastro)', calculo: 'Homens/mês × Nº de UH × Realizado Mês ÷ 100 — mesma medida do Power BI, mantida a pedido.' },
    { n: 10, titulo: 'Andamento geral', origem: '`Realizado Acumulado` (' + IG + ')' },
    { n: 11, titulo: '+ Infos da obra', texto: 'Abre a ficha da obra em tela cheia (próximo capítulo).' },
  ])}
  <div class="validar"><b>Para validar</b>As correções em relação ao Power BI (aditivos aprovados, % de reajuste, desvio do mês seguinte, avanço mês CEF, saldos sem dupla contagem, assertividade média) estão listadas em <code>docs/CALCULOS.md</code>. Se alguma não for desejada, a regra está isolada e volta ao comportamento original.</div>
`);

cap('ficha', 'Resumo Geral', 'Ficha da obra (+ Infos da obra)', telaAnotada('ficha-obra', 'Ficha da obra em tela cheia', [
  { n: 1, titulo: 'Identificação', origem: 'cadastro: cliente, obra, endereço, bairro, cidade, Nº UAU, situação' },
  { n: 2, titulo: 'Destaques', origem: 'Avanço físico = `Realizado Acumulado` do último mês fechado (BD_Infos Gerais); demais: cadastro (UH, unidades habitáveis, áreas, coeficiente AE/AP, torres, banda)' },
  { n: 3, titulo: 'Equipe', origem: 'cadastro: diretoria, gestão (GGO de construção), coordenação, engenharia, planejamento' },
  { n: 4, titulo: 'Características', origem: 'cadastro: tipologia, padrão, sistema estrutural, fundação' },
  { n: 5, titulo: 'Prazos', origem: 'cadastro: início, fim meta, fim cliente final, fim incorporador, prazo inicial e meta' },
  { n: 6, titulo: 'Orçamento e INCC', origem: 'cadastro: orçamento base, mês do orçamento, INCC do orçamento, data-base INCC' },
]));

cap('resumo-fisico', 'Aba Resumo Físico', 'Resumo Físico', `
  <p>Uma linha por item da EAP da obra no mês de referência. Itens pai (ex.: <code>04</code>) recolhem os filhos (<code>04.01</code>). A linha da obra (total) vem do BD_Infos Gerais.</p>
  ${telaAnotada('resumo-fisico', 'Resumo Físico com o item Estrutura expandido', [
    { n: 1, titulo: 'Comentário do mês e principais metas', origem: '`Comentário Obra` e `Principais Metas Obra` (' + IG + '; na visão Cliente, as colunas do cliente)' },
    { n: 2, titulo: 'Projeção econômica', origem: 'Orçamento = `Orçamento Base Físico` do item (`BD_Orc`); Orç. projetado = `Custo Projetado Total` e IEC = `IEC Obra` do mesmo item em `BD_Econômico` (só itens pai)' },
    { n: 3, titulo: 'Mês de referência', origem: '`BD_Físico por atividade` (item e mês)', calculo: 'Realizado acm `Realizado Acumulado` · Realizado mês `Realizado Mês` · Planejado inicial `Meta Acumulada - Inicial` · Planejado acm `Meta Acumulada - Atual` · Planejado mês `Meta Mês - Atual` · % acerto `Assertividade` · Cronograma `Replanejado Atual Acumulado - Obra` · Adiant. = Realizado acm − Cronograma.' },
    { n: 4, titulo: 'Mês seguinte', origem: '`BD_Físico por atividade`', calculo: 'Planejado mês `Meta Mês - Mês Subsequente` · Planejado acm `Meta Acumulado - Mês Subsequente` · Previsto = `Replanejado Atual Acumulado` do mês seguinte · Adiant. = Planejado acm − Previsto.' },
    { n: 5, titulo: 'Pesos', origem: '`Peso Atraso / Adiantamento` e `Peso Planejado na Meta` (`BD_Físico por atividade`)' },
    { n: 6, titulo: 'Linha da obra (total)', origem: IG + ' e Orçamento Geral do `BD_Orc`' },
    { n: 7, titulo: 'Recolher / expandir', texto: 'Começa recolhido; "Expandir tudo"/"Recolher tudo" no topo. Pai = código sem ponto.' },
    { n: 8, titulo: 'Marcador de comentário', origem: '`Comentários - Obra` da atividade (visão Cliente: `Comentários - Cliente`)', texto: 'O mesmo selo é usado no Resumo Econômico.' },
    { n: 9, titulo: 'Ocultar / exibir projeção econômica e pesos', texto: 'Esconde as colunas 2 e 5; a escolha fica lembrada no navegador.' },
  ])}
`);

cap('resumo-economico', 'Aba Resumo Econômico', 'Resumo Econômico (IEC)', `
  <p>Uma linha por item do <code>BD_Econômico</code> no mês de referência; a linha da obra é o item <code>Geral</code>. Mesma apresentação do Resumo Físico.</p>
  ${telaAnotada('resumo-economico', 'Resumo Econômico com o item Estrutura expandido', [
    { n: 1, titulo: 'Indicadores do topo', origem: EC, calculo: '`Avanço`, `Custo Lançado`, `Orçamento de Término`, `Custo Projetado Total`, `Resultado Projetado Obra`, `IEC Obra`, `Resultado Sem Correção`, `IEC Sem correção`, `% Contratado`. Valores em R$ compactos; o completo aparece ao passar o mouse e na linha da obra.' },
    { n: 2, titulo: 'Colunas agrupadas', texto: 'Execução, Projeção, Resultado, Sem correção e Contratação — mesmas colunas acima, por item.' },
    { n: 3, titulo: 'Linha da obra', origem: '`BD_Econômico`, item `Geral`' },
    { n: 4, titulo: 'Detalhe do item (3 × 4)', origem: '`BD_Econômico`, item e mês', calculo: 'Custos: `Custo Pago`, `NFs Lançadas`, `Custo em Sistema`, `Comprometimentos e Rateios` · Saldos: `Saldos OC`, `Saldos Contratos`, `Saldo de Orçamento`, `Custo Passível de Reajuste` · Mês e aditivos: `Custo Lançado Mês`, `Custo Pago Mês`, `Variação Mês - Custo`, `Total de Aditivos`.' },
    { n: 5, titulo: 'Comentários do item', origem: '`Variações principais`, `Variação do mês`, `Contingências` (texto "0" é tratado como vazio)' },
    { n: 6, titulo: 'Rodapé congelado', origem: EC, calculo: '`Custo Pago Mês`, `Custo Passível de Reajuste`, `Total de Aditivos`, `Aditivos sem Aprovação`, `Custos Fora Contrato`, `Variação Mês - Custo`. Fica fixo no pé da tela.' },
  ])}
  <div class="nota"><b>IEC igual a zero</b>Na planilha, IEC 0 significa "sem IEC" (a consulta do Power BI trocava "-" por 0); aqui aparece "—".</div>
`);

cap('galeria', 'Abas Tempo x Caminho e Fotos', 'Tempo x Caminho e Acompanhamento Fotográfico', `
  <p>As imagens são cadastradas pelo Planejamento em <b>Administração → TxC e fotos</b>, vinculadas a obra + mês + torre (TxC) ou local (fotos). Não vêm do SharePoint. A integração direta com o app de TxC está em estudo (<code>docs/ESTUDO_TXC.md</code>).</p>
  ${telaAnotada('tempo-caminho', 'Tempo x Caminho', [
    { n: 1, titulo: 'Meses com imagens', texto: 'Contagem por mês; borda laranja = mês de referência. Abre no mês de referência ou no mais recente anterior.' },
    { n: 2, titulo: 'Torres', origem: 'campo **Torre** do cadastro da imagem' },
    { n: 3, titulo: 'Imagem', texto: 'Setas sobre a imagem e ← → do teclado navegam.' },
    { n: 4, titulo: 'Ampliar', texto: 'Tela cheia; Esc fecha.' },
    { n: 5, titulo: 'Painel lateral', origem: 'torre, mês e **comentário** do cadastro da imagem' },
    { n: 6, titulo: 'Miniaturas', texto: 'Aparecem quando há mais de uma imagem na torre.' },
    { n: 7, titulo: 'Cadastrar TxC', texto: 'Só para Planejamento e Dev.' },
  ])}
  ${telaAnotada('fotos', 'Acompanhamento Fotográfico', [
    { n: 1, titulo: 'Meses com fotos' },
    { n: 2, titulo: 'Locais', origem: 'campo **Local** do cadastro da foto' },
    { n: 3, titulo: 'Foto', texto: 'Na visão Cliente só aparecem as imagens marcadas "Exibir na apresentação ao cliente".' },
    { n: 4, titulo: 'Comentário', origem: 'cadastro da foto' },
  ])}
`);

cap('telas-cliente', 'Apresentação Cliente', 'Telas do cliente', telaAnotada('tela-cliente', 'Tela criada pelo Planejamento', [
  { n: 1, titulo: 'Tela no menu', texto: 'Aparece na apresentação Cliente para as obras escolhidas (ou todas), na ordem definida.', origem: 'Administração → Telas do cliente' },
  { n: 2, titulo: 'Planilha somente leitura', origem: 'arquivo XLSX/XLS/CSV enviado; abre a aba escolhida (ou a primeira), com abas clicáveis quando houver mais de uma' },
  { n: 3, titulo: 'Imagem', origem: 'arquivo enviado' },
  { n: 4, titulo: 'Texto livre' },
]));

cap('administracao', 'Planejamento e Dev', 'Administração', `
  ${telaAnotada('admin-cadastro', 'Cadastro de obras', [
    { n: 1, titulo: 'Seções da administração', texto: 'Usuários aparece só para o Dev.' },
    { n: 2, titulo: 'Importar planilha', texto: 'Planilha "Painel de Obras" (mesmos cabeçalhos do Power BI). Obras já cadastradas são atualizadas.' },
    { n: 3, titulo: 'Nova obra' },
    { n: 4, titulo: 'Linha da obra', texto: 'Obras das planilhas sem cadastro aparecem com o selo "sem cadastro".' },
  ])}
  ${telaAnotada('admin-midia-form', 'Cadastro de TxC / fotos', [
    { n: 1, titulo: 'Obra, mês, torre/local e ordem' },
    { n: 2, titulo: 'Comentário', texto: 'Aparece ao lado da imagem na apresentação.' },
    { n: 3, titulo: 'Área de envio', texto: 'Arraste ou clique; várias imagens viram vários registros com os mesmos dados.' },
    { n: 4, titulo: 'Exibir ao cliente', texto: 'Desmarcado = só a apresentação Obra mostra.' },
  ])}
  ${telaAnotada('admin-tela-form', 'Edição de tela do cliente', [
    { n: 1, titulo: 'Título, subtítulo e ordem no menu' },
    { n: 2, titulo: 'Bloco de conteúdo', texto: 'Título, largura (inteira/meia) e, para planilha, a aba a exibir. O arquivo é enviado na hora.' },
    { n: 3, titulo: 'Adicionar bloco', texto: 'Imagem, planilha ou texto.' },
  ])}
  ${telaAnotada('admin-fontes', 'Fontes de dados e INCC', [
    { n: 1, titulo: 'Planilhas', texto: 'Origem, horário da última leitura e linhas de cada aba.' },
    { n: 2, titulo: 'INCC-DI', texto: 'Últimos meses, origem de cada índice (FGV, BCB/SGS ou manual), busca de meses novos e correção manual.' },
  ])}
`);

export function mapaDeDados() {
  return pagina({
    titulo: 'Mapa de dados da apresentação',
    eyebrow: 'Funcionalidades e origem das informações',
    subtitulo: 'Cada tela da apresentação Obra/Cliente com pontos numerados: o que é, de onde vem (aba e coluna) e como é calculado. Use para validar os números contra o Power BI e as planilhas.',
    sumario: capitulos.map((c) => [c.id, c.titulo]),
    corpo: capitulos.map((c) => c.html).join(''),
  });
}
