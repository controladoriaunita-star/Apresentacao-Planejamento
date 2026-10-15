-- ─────────────────────────────────────────────────────────────────────────────
-- Apresentação Planejamento — banco no Supabase (projeto exclusivo deste app)
--
-- O que fica aqui: perfis de acesso, cadastro de obras, anexos (metadados), TxC/fotos e telas do cliente.
-- O que NÃO fica aqui: obras e curvas — continuam lidas do SharePoint (Microsoft Graph).
-- Login e senhas: Supabase Auth (auth.users). Arquivos: Storage, bucket privado "apresentacao".
--
-- Segurança: RLS ligado e nenhuma política. Ninguém lê nem grava direto do navegador; tudo passa pela
-- API do app (Vercel), que usa a chave service role só no servidor.
--
-- Rodar uma vez no SQL Editor do Supabase (é idempotente: pode rodar de novo sem estragar nada).
-- ─────────────────────────────────────────────────────────────────────────────

-- Perfis: 1 por usuário do Auth. Papel: dev (tudo), planejamento (conteúdo), viewer (só vê).
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  papel text not null check (papel in ('dev', 'planejamento', 'viewer')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz,
  ultimo_acesso timestamptz
);

-- Cadastro de obras (UH, áreas, INCC base, prazos, equipe…). Os campos do formulário ficam em `dados`
-- (definição em public/js/domain/cadastro-obra.js); `chave` = nome da obra normalizado (junção com o SharePoint).
create table if not exists public.cadastro_obras (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  obra text not null,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz,
  atualizado_por text
);

-- Anexos: metadados; o binário fica no Storage em `caminho` (anexos/<id>).
create table if not exists public.arquivos (
  id uuid primary key,
  nome text not null,
  tipo text not null,
  categoria text not null check (categoria in ('imagem', 'pdf', 'planilha')),
  tamanho bigint not null check (tamanho > 0),
  caminho text not null,
  enviado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);

-- Tempo x Caminho e fotos: uma imagem por registro, por obra + mês + torre/local.
create table if not exists public.midias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('txc', 'foto')),
  obra text not null,
  chave_obra text not null,
  mes text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  grupo text,
  comentario text,
  arquivo_id uuid not null references public.arquivos (id) on delete restrict,
  visivel_cliente boolean not null default true,
  ordem integer not null default 0,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz
);
create index if not exists midias_obra_tipo_mes on public.midias (chave_obra, tipo, mes);

-- Telas extras da apresentação Cliente (planilhas somente leitura, imagens, textos).
create table if not exists public.telas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  subtitulo text,
  obras text[] not null default '{}', -- chaves das obras; vazio = todas
  ordem integer not null default 0,
  ativa boolean not null default true,
  blocos jsonb not null default '[]'::jsonb,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz
);

-- RLS ligado sem políticas: acesso só pela API (service role).
alter table public.perfis enable row level security;
alter table public.cadastro_obras enable row level security;
alter table public.arquivos enable row level security;
alter table public.midias enable row level security;
alter table public.telas enable row level security;

-- Storage: bucket privado. 25 MB por arquivo; tipos aceitos = os do app + JSON (cache das planilhas e INCC).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'apresentacao', 'apresentacao', false, 26214400,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/json'
  ]
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
