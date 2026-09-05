-- Схема БД проекта «Метафорические карты» (Этап 2).
-- Выполнить один раз в Supabase → SQL Editor → New query → Run.
-- Скрипт идемпотентный: повторный запуск ничего не сломает.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- decks ---
create table if not exists public.decks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  price        integer not null default 0,
  cover_image  text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- cards ---
do $$
begin
  create type public.card_source as enum ('uploaded', 'generated');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.cards (
  id           uuid primary key default gen_random_uuid(),
  deck_id      uuid references public.decks(id) on delete cascade,
  image_url    text not null,
  text         text,
  source_type  public.card_source not null default 'uploaded',
  price        integer,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists cards_deck_id_idx on public.cards (deck_id);

-- ---------------------------------------------------------------- leads ---
-- Заполняется на Этапе 4 (тестовая кнопка оплаты). Создаём сразу,
-- чтобы не возвращаться к миграциям.
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid references public.decks(id) on delete set null,
  tariff      text,
  contact     text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------- generations ---
-- Журнал генераций (Этап 3). По нему считается лимит: сколько карт посетитель
-- сгенерировал за сутки. Адрес не хранится — только его хеш, для лимита
-- отпечатка достаточно.
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  ip_hash     text,
  card_id     uuid references public.cards(id) on delete set null,
  prompt      text,
  created_at  timestamptz not null default now()
);

create index if not exists generations_session_idx
  on public.generations (session_id, created_at desc);
create index if not exists generations_ip_idx
  on public.generations (ip_hash, created_at desc);

-- ------------------------------------------------------------------ RLS ---
-- Включаем защиту и НЕ создаём политик: сайт ходит в базу с service-role
-- ключом, который RLS обходит. Анонимный (публичный) ключ при этом не даёт
-- доступа к таблицам вообще — данные нельзя вытащить из браузера напрямую.
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.leads enable row level security;
alter table public.generations enable row level security;

-- -------------------------------------------------------------- storage ---
-- Публичный бакет для картинок карт и обложек колод.
insert into storage.buckets (id, name, public)
values ('cards', 'cards', true)
on conflict (id) do update set public = true;
