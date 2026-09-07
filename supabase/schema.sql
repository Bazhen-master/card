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

-- ------------------------------------------------------------- profiles ---
-- Учётные записи посетителей (Этап 6.1). Пароли лежат не здесь, а в
-- auth.users Supabase: проверять и хешировать их самим незачем. В profiles —
-- то, что нужно сайту: почта для показа и связи, имя автора под картой и
-- признак блокировки.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  is_blocked    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------- sessions ---
-- Сессии сайта. Своя таблица, а не токен Supabase: все запросы к базе и так
-- идут служебным ключом с сервера, а строка в таблице даёт то, чего у токена
-- нет, — возможность закрыть доступ немедленно, просто удалив её.
create table if not exists public.sessions (
  token       uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists sessions_profile_idx on public.sessions (profile_id);

-- --------------------------------------------- привязка карт к аккаунту ---
-- Карта знает своего автора. У карт, загруженных владелицей сайта через
-- админку, автора нет — там owner_id остаётся пустым.
alter table public.cards
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

create index if not exists cards_owner_idx on public.cards (owner_id);

-- Журнал генераций тоже помнит аккаунт: у вошедшего суточный лимит считается
-- по нему, и очистка cookie больше не обнуляет счётчик.
alter table public.generations
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

create index if not exists generations_profile_idx
  on public.generations (profile_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;

-- -------------------------------------------------------------- storage ---
-- Публичный бакет для картинок карт и обложек колод.
insert into storage.buckets (id, name, public)
values ('cards', 'cards', true)
on conflict (id) do update set public = true;
