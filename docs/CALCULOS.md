# Cálculos — do Power BI para o código

Fonte: medidas DAX extraídas de `One Page - Planejamento e Controle.pbix` (modelo + páginas). Código em
`public/js/domain/`. Toda regra tem teste em `tests/domain/medidas.test.mjs`.

## Fontes

| Power BI | Aqui | Observação |
|---|---|---|
| BD_Infos Gerais, BD_Físico por atividade, BD_Orc, BD_Econômico (pastas locais) | Mesmas abas via Microsoft Graph | Junção entre abas pelo **nome da obra normalizado** (o BD_Econômico não tem Nº UAU e há grafias diferentes, ex. "MetroCasa"/"Metrocasa"). |
| BD_Infos para IEC Gerais | Linha `Item = Geral` do BD_Econômico | Era só um filtro da mesma aba. |
| dCadastrodeObras (pasta "13 - Painel de Obras") | **Cadastro de obras no app** | Não está nas abas do SharePoint. Importa a planilha "Painel de Obras". |
| dINCC (pasta "14 - INCC") | Histórico FGV + BCB/SGS 192 | Atualiza sozinho (1×/dia) e aceita correção manual. |
| BD_FotosTxC, BD_FotosAtividades (listas SharePoint) | Cadastro de TxC e fotos no app | Mesmo conceito: imagem + obra + mês + torre/local + comentário. |

## Visões Obra × Cliente

A visão Cliente troca as colunas "- Obra" pelas "- Cliente" (`colunas.js`): previsto original, 1º replanejado,
replanejado atual (acumulado e mês), comentários, principais metas e peso de atraso. Metas e realizado não têm
variante de cliente.

## Mês de referência

As planilhas trazem 36 meses por obra, inclusive futuros (realizado repetido/zerado). Mês fechado da obra = último
mês com "Realizado Mês" > 0. Referência padrão = o mais recente entre as obras filtradas, sem passar do mês atual.

## Medidas mantidas como no Power BI

| Medida | Fórmula |
|---|---|
| Desvio Físico | Realizado Acm − Replanejado Atual Acm (Obra) |
| Desvio CEF | Realizado/Projetado Acm Banco 1ª Fase − Previsto Acm Banco 1ª Fase (0 se a obra não tem curva CEF) |
| Desvio CEF próximo mês | mesma conta no mês seguinte |
| Orçamento Geral (Orçado) | BD_Orc, ITEM = Geral, "Orçamento Base Físico" |
| Projetado | BD_Econômico Geral, "Custo Projetado Total" |
| Desvio R$ | Orçado − Projetado |
| % indireto | Custo Projetado do item 16 ÷ Custo Projetado Geral |
| Custo pago e a pagar | Custo Pago + NFs Lançadas |
| Custos por (sem correção) | (Orçado − Resultado Sem Correção) ÷ Nº UH / Área Equivalente / Área Privativa / Área Construída |
| NH-NU | Homens/mês × Nº UH × Realizado Mês ÷ 100 (pedido: "usar a medida") |
| Andamento geral | Realizado Acumulado (velocímetro 0–100%) |
| Atraso/Adiantamento (Resumo Físico) | Realizado Acm − Cronograma (Replanejado Atual Acm) |
| Atraso projetado | Meta Acumulada Mês Subsequente − Replanejado Atual Acm do mês seguinte |

## Divergências intencionais (correções)

| Item | Power BI | Aqui | Motivo |
|---|---|---|---|
| Aditivos Aprovados | Aditivos sem Aprovação − Total | **Total − A aprovar** | Sinal estava invertido. |
| % Reajuste INCC | INCC Base ÷ INCC Mês | **INCC Mês ÷ INCC Base − 1** | O original dava o inverso (ex.: 0,87 em vez de +15%). |
| Desvio Mês seguinte (Físico) | X − X (sempre 0) | Projetado Acm (meta subsequente) − Previsto Acm do mês seguinte | Medida anulava a si mesma. |
| Bloco "mês seguinte" Físico | Projetado = replanejado do mês seguinte (igual ao Previsto) | Projetado = **Meta do mês subsequente**; Previsto = replanejado do mês seguinte | Com o original Projetado e Previsto eram a mesma coluna. |
| Avanço Mês CEF | "Cronograma Mês - Banco 1ª Fase" | **"Realizado/Projetado Mês - Banco 1ª Fase"** | A linha "Avanço" das demais colunas usa o realizado; o cronograma tem linha própria. |
| Saldos OCs e contratos | SUM de todas as linhas (Geral + itens) | Só a linha Geral | Somava o total duas vezes. |
| Várias obras no filtro | MAX() entre obras | % ponderado pelo orçamento; R$ somado; IEC = Σ projetado ÷ Σ orçado | MAX mostrava o maior valor de qualquer obra. |
| Assertividade média da empresa | Σ assertividade ÷ nº de obras ativas (sem fechamento conta 0) | Média entre as obras que fecharam o mês | Obras sem fechamento puxavam a média para baixo. |
| "Sem Repetição" nos gráficos | Apaga qualquer valor repetido mais de N vezes | Só corta a sequência repetida **no fim** da série | O original apagava meses com o mesmo planejado (ex.: 5% todo mês). |
| IEC = 0 | Exibido como 0 | Exibido como "—" | A consulta trocava "-" por 0; IEC real nunca é zero. |

Se alguma correção não for desejada, a regra está isolada em uma função com o nome da medida em `domain/`.
