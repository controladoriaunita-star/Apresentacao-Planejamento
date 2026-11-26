-- ─────────────────────────────────────────────────────────────────────────────
-- v26 — IAT (Informativo do Acidente do Trabalho) e IST (Informativo de Segurança do Trabalho).
--
-- Rodar uma vez no SQL Editor do Supabase, depois do 007 e ANTES de publicar (é idempotente).
--
-- Decisões:
-- - Número sequencial, obra e auditoria em colunas; o formulário inteiro (campos, evidências, plano de ação,
--   fotos e complementos da IAT Metrocasa) em `dados` (jsonb), como o Cadastro de obras. A estrutura do
--   formulário é validada pela API (public/js/domain/informativos.js → normalizarIat / normalizarIst).
-- - Fotos e anexos ficam na tabela `arquivos` / Storage; `dados` guarda só os ids.
-- - RLS ligado e nenhuma política: só a API (service role) lê e grava — há CPF e diagnóstico nos dados.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.informativos_iat (
  id uuid primary key default gen_random_uuid(),
  numero integer not null,
  obra_id uuid references public.cadastro_obras (id) on delete restrict,
  dados jsonb not null default '{}'::jsonb,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz
);

create table if not exists public.informativos_ist (
  id uuid primary key default gen_random_uuid(),
  numero integer not null,
  obra_id uuid references public.cadastro_obras (id) on delete restrict,
  dados jsonb not null default '{}'::jsonb,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz
);

create unique index if not exists informativos_iat_numero on public.informativos_iat (numero);
create unique index if not exists informativos_ist_numero on public.informativos_ist (numero);

alter table public.informativos_iat enable row level security;
alter table public.informativos_ist enable row level security;
