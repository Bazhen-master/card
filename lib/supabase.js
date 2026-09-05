import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Пока ключи не заданы, сайт не должен падать: страницы показывают
// сообщение о настройке вместо ошибки сборки.
export const isSupabaseConfigured = Boolean(url && serviceKey);

export const CARDS_BUCKET = "cards";

// Service-role ключ обходит RLS, поэтому клиент создаётся только на сервере
// (серверные компоненты и server actions) и никогда не уходит в браузер.
export function getSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase не настроен: задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: {
      // Supabase ходит через глобальный fetch, а Next.js его подменяет и
      // кэширует ответы на диск (.next/cache/fetch-cache). Без no-store
      // страницы показывают устаревшие данные после правок в админке —
      // причём кэш переживает перезапуск сервера.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
