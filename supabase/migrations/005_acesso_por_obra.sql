-- ─────────────────────────────────────────────────────────────────────────────
-- v26 — Acesso por obra e por apresentação (Administração → Usuários).
-- Regras em public/js/domain/acesso.js; só restringem o papel Viewer.
--
--   obras          null = todas as obras (inclui as que entrarem depois na planilha);
--                  lista de chaves (nome da obra normalizado) = só essas; lista vazia = nenhuma.
--   apresentacoes  'ambas' (padrão) | 'obra' | 'cliente'.
--
-- Usuários existentes ficam com obras = null e apresentacoes = 'ambas', ou seja, continuam vendo tudo.
-- Rodar uma vez no SQL Editor do Supabase, depois do 001 a 004 (é idempotente).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.perfis add column if not exists obras text[];
alter table public.perfis add column if not exists apresentacoes text not null default 'ambas';

alter table public.perfis drop constraint if exists perfis_apresentacoes_check;
alter table public.perfis
  add constraint perfis_apresentacoes_check check (apresentacoes in ('ambas', 'obra', 'cliente'));
