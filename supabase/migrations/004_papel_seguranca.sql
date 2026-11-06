-- ─────────────────────────────────────────────────────────────────────────────
-- v23 — Papel "Segurança": acessa só Administração → Segurança do Trabalho e o Dashboard Segurança
-- (public/js/domain/permissoes.js). Amplia a lista de papéis aceitos na tabela `perfis`.
--
-- Rodar uma vez no SQL Editor do Supabase, depois do 001, 002 e 003 (é idempotente).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis
  add constraint perfis_papel_check check (papel in ('dev', 'planejamento', 'seguranca', 'viewer'));
