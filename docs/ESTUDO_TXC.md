# Estudo — gráfico de Tempo x Caminho direto do app TxC

**Situação:** estudo apenas. O que está implantado é o cadastro de **imagens** de TxC por obra + mês + torre.

## O que o app TxC tem hoje (pasta `Projeto TxC - APP`)

- Front React (Vite) + servidor Express (`server/`) + Supabase (Postgres).
- Tabelas `projetos` e `atividades`, com o conteúdo do TxC em colunas `dados jsonb` (mais `macrofluxos`, `grupos`,
  `historico_avanco`, `atividade_comentarios`).
- API REST com rotas `/projetos`, `/atividades`, `/grupos`, `/macrofluxos`, protegida por cabeçalho `X-API-KEY`
  (`server/middleware/apiKey.js`) e JWT.
- O gráfico é o componente React `src/components/chart/FlowlineChart.jsx` (linhas de balanço/flowline).

## Opções

| Opção | Como | Prós | Contras |
|---|---|---|---|
| A. Ler os dados e desenhar aqui | Servidor da apresentação chama `GET /projetos/:id` e `/atividades?projeto=` do TxC com `X-API-KEY`; o gráfico é portado de `FlowlineChart.jsx` para SVG puro em `public/js/ui/` | Sempre atualizado; visual no padrão Unità; filtra por mês de referência | Portar o desenho do flowline; depender do formato do `jsonb` |
| B. Incorporar a tela do TxC | `<iframe>` de uma rota somente leitura do TxC (`/apresentacao/:projeto`) | Rápido; zero duplicação | Precisa criar a rota e um login/token de leitura no TxC; visual diferente |
| C. Exportar imagem automaticamente | O TxC gera PNG do gráfico (ex.: ao salvar) e envia para `POST /api/arquivos` + `POST /api/midias` daqui | Reaproveita o fluxo de imagens já implantado | Imagem estática; exige rotina no TxC |

## Recomendação

**Opção A**, em duas etapas:
1. Vincular projeto do TxC ↔ obra: guardar `txcProjetoId` no cadastro de obras (campo novo).
2. Rota `GET /api/txc/:obra` no servidor (com `TXC_API_URL` e `TXC_API_KEY` no `.env`), devolvendo atividades e
   avanços; desenho em SVG com as mesmas regras de série/cores dos demais gráficos.

Pré-requisitos a confirmar: chave de API de leitura dedicada para a apresentação; formato estável do `dados jsonb`
das atividades (início, fim, pavimento/torre, avanço); se o TxC já guarda o realizado mês a mês (`historico_avanco`).

Até lá, a aba Tempo x Caminho usa as imagens cadastradas pelo Planejamento.
