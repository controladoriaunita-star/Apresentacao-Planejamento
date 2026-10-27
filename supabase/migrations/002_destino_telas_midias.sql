-- ─────────────────────────────────────────────────────────────────────────────
-- v19 — Destino das telas extras e das imagens (TxC/fotos): apresentação Obra, Cliente ou ambas.
-- Valores: 'ambas' | 'obra' | 'cliente' (public/js/domain/conteudo.js → DESTINOS).
--
-- Rodar uma vez no SQL Editor do Supabase, depois do 001 (é idempotente).
-- ─────────────────────────────────────────────────────────────────────────────

-- Telas: as que já existiam eram só da apresentação Cliente.
alter table public.telas
  add column if not exists destino text not null default 'cliente'
  check (destino in ('ambas', 'obra', 'cliente'));

-- Mídias: as que já existiam apareciam sempre na Obra e, se visíveis, no Cliente.
-- `visivel_cliente` continua sendo gravada (derivada do destino) para compatibilidade.
alter table public.midias
  add column if not exists destino text not null default 'ambas'
  check (destino in ('ambas', 'obra', 'cliente'));
update public.midias set destino = 'obra' where visivel_cliente = false and destino = 'ambas';
