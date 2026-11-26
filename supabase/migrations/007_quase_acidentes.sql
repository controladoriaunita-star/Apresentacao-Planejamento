-- ─────────────────────────────────────────────────────────────────────────────
-- v25 — Quase acidentes na tabela `acidentes` (tipo 'QA' + categoria padronizada).
--
-- Rodar uma vez no SQL Editor do Supabase, depois do 003 e ANTES de publicar (é idempotente).
--
-- Decisões:
-- - Quase acidente não tem acidentado, parte do corpo nem dias de afastamento; fase, função e empresa são
--   opcionais. Por isso essas colunas deixam de ser NOT NULL, e o check `acidentes_campos_por_tipo` mantém
--   todas obrigatórias para os demais tipos (CPT, SPT, TRJ, FT): nada muda para os acidentes.
-- - `categoria` só existe em quase acidente e é obrigatória nele.
-- - Importação sem de-para: `obra_id` fica vazio e `obra_planilha` guarda o nome que veio na planilha.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.acidentes add column if not exists categoria text;
alter table public.acidentes add column if not exists obra_planilha text;

alter table public.acidentes alter column obra_id drop not null;
alter table public.acidentes drop constraint if exists acidentes_obra_ou_planilha;
alter table public.acidentes add constraint acidentes_obra_ou_planilha check (
  obra_id is not null or length(btrim(coalesce(obra_planilha, ''))) > 0
);

alter table public.acidentes alter column fase_obra drop not null;
alter table public.acidentes alter column nome_acidentado drop not null;
alter table public.acidentes alter column funcao drop not null;
alter table public.acidentes alter column empresa drop not null;
alter table public.acidentes alter column parte_corpo drop not null;
alter table public.acidentes alter column dias_afastamento drop not null;

alter table public.acidentes drop constraint if exists acidentes_tipo_check;
alter table public.acidentes add constraint acidentes_tipo_check check (tipo in ('CPT', 'SPT', 'TRJ', 'FT', 'QA'));

alter table public.acidentes drop constraint if exists acidentes_categoria_check;
alter table public.acidentes add constraint acidentes_categoria_check check (categoria in (
  'Instalações Elétricas / DR / Iluminação', 'Máquinas e Equipamentos', 'Proteção Contra Quedas / Periferia',
  'Documentações e Gestão de SST', 'Área de Vivência / Bebedouros e Chuveiros', 'Aberturas de Pisos e Shafts',
  'Uso de EPIs / Cinto de Segurança', 'Organização e Limpeza', 'Alojamentos / Conservação e Armários',
  'Proteção Contra Incêndio', 'Área de Vivência / Projetos', 'Escadas e Rampas', 'Primeiros Socorros / Emergência',
  'Canteiro / Caminho Seguro e Sinalização'));

alter table public.acidentes drop constraint if exists acidentes_campos_por_tipo;
alter table public.acidentes add constraint acidentes_campos_por_tipo check (
  case when tipo = 'QA'
    then categoria is not null and nome_acidentado is null and parte_corpo is null and dias_afastamento is null
    else categoria is null and fase_obra is not null and nome_acidentado is not null and funcao is not null
      and empresa is not null and parte_corpo is not null and dias_afastamento is not null
  end
);
