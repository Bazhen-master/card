import { createClient } from "@supabase/supabase-js";

// SUPABASE_URL читается во время работы сервера, а значения с префиксом
// NEXT_PUBLIC_ Next.js подставляет в код ещё на сборке. Если задать только
// NEXT_PUBLIC_SUPABASE_URL уже после первой сборки, в собранном коде навсегда
// останется пустое значение. Поэтому основной вариант — SUPABASE_URL,
// а NEXT_PUBLIC_SUPABASE_URL оставлен для совместимости.
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Пока ключи не заданы, сайт не должен падать: страницы показывают
// сообщение о настройке вместо ошибки сборки.
export const isSupabaseConfigured = Boolean(url && serviceKey);

// Список незаданных переменных — подсказка называет конкретную причину,
// а не общее «база не подключена».
export function missingSupabaseEnv() {
  const missing = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

export const CARDS_BUCKET = "cards";

// Service-role ключ обходит RLS, поэтому клиент создаётся только на сервере
// (серверные компоненты и server actions) и никогда не уходит в браузер.
export function getSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase не настроен: задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY"
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
