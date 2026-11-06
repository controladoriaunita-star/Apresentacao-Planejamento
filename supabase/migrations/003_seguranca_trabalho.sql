-- ─────────────────────────────────────────────────────────────────────────────
-- v22 — Segurança do Trabalho: acidentes por obra (Administração → Segurança do Trabalho,
-- abas Dashboard Segurança e Segurança do Trabalho).
--
-- Rodar uma vez no SQL Editor do Supabase, depois do 001 e do 002 (é idempotente).
--
-- Decisões:
-- - Cada acidente aponta para o cadastro da obra (`obra_id` → cadastro_obras.id). Incorporador (= Cliente) e
--   Método construtivo (= Sistema estrutural) NÃO são copiados: a API lê do cadastro a cada consulta, então
--   não existe divergência entre o acidente e o Cadastro de obras.
-- - `on delete restrict`: um cadastro de obra com acidentes não pode ser excluído (a API avisa antes).
-- - `chave_dedup` única: data + obra + acidentado + tipo + parte do corpo + função + empresa (normalizados).
--   Impede que a planilha acumulativa importe de novo o mesmo acidente (public/js/domain/seguranca.js →
--   chaveDeduplicacao). Dias de afastamento e resumo ficam fora da chave porque costumam ser corrigidos.
-- - Listas fechadas (tipo, parte do corpo, fase) também validadas no banco, além da API.
-- - RLS ligado e nenhuma política, como as demais tabelas: só a API (service role) lê e grava.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.acidentes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.cadastro_obras (id) on delete restrict,
  data date not null,
  fase_obra text not null check (fase_obra in ('Fundação', 'Estrutura', 'Acabamento', 'Assistência Técnica')),
  nome_acidentado text not null check (length(btrim(nome_acidentado)) > 0),
  funcao text not null check (length(btrim(funcao)) > 0),
  empresa text not null check (length(btrim(empresa)) > 0),
  tipo text not null check (tipo in ('CPT', 'SPT', 'TRJ', 'FT')),
  parte_corpo text not null check (parte_corpo in (
    'Dedo', 'Pé', 'Cabeça', 'Ombro', 'Joelho', 'Braço', 'Olho', 'Mandíbula', 'Mão', 'Perna', 'Coluna', 'Boca',
    'Peito', 'Tornozelo', 'Rosto', 'Costas', 'Coxa', 'Antebraço', 'Punho', 'Nariz', 'Abdômen', 'Queixo', 'Canela', 'Dorso')),
  dias_afastamento integer not null check (dias_afastamento >= 0),
  resumo text not null check (length(btrim(resumo)) > 0),
  chave_dedup text not null,
  origem text not null default 'manual' check (origem in ('manual', 'importacao')),
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz
);

create unique index if not exists acidentes_chave_dedup on public.acidentes (chave_dedup);
create index if not exists acidentes_obra_data on public.acidentes (obra_id, data);
create index if not exists acidentes_data on public.acidentes (data);

alter table public.acidentes enable row level security;
