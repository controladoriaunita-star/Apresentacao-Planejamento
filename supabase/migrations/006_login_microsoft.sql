-- ─────────────────────────────────────────────────────────────────────────────
-- v35 — Login com a conta Microsoft (Office 365 / Entra ID).
--
--   login   'microsoft' (padrão) = entra com a conta do Office 365; com AUTH_MODE=entra não usa mais senha do app.
--           'senha'               = e-mail e senha do app (quem não tem conta no 365, ex.: clientes).
--
-- Só ACRESCENTA uma coluna: nenhum dado existente muda. Todos os usuários atuais ficam como 'microsoft'.
-- Rodar uma vez no SQL Editor do Supabase, depois do 001 a 005 (é idempotente) e ANTES de ligar AUTH_MODE=entra.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.perfis add column if not exists login text not null default 'microsoft';

alter table public.perfis drop constraint if exists perfis_login_check;
alter table public.perfis
  add constraint perfis_login_check check (login in ('microsoft', 'senha'));

-- Quem NÃO tem conta no Office 365 continua com a senha do app. Marque antes de ligar o login Microsoft —
-- pela tela Administração → Usuários (campo "Tipo de login") ou aqui, trocando os e-mails do exemplo:
--
-- update public.perfis set login = 'senha'
--  where email in ('cliente1@unitaengenharia.com.br', 'cliente2@unitaengenharia.com.br');
