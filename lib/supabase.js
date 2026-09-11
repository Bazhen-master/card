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

// Ни у fetch в Node, ни у клиента Supabase своего таймаута нет: если
// соединение с supabase.co подвисло, запрос висит вечно, а вместе с ним —
// страница у посетителя. Домен зарубежный, и из России такое случается,
// поэтому предел ставим сами. Чтение — двадцать секунд с запасом: столько
// не идёт ни один нормальный ответ. Запись дольше: из админки загружаются
// файлы до 25 МБ, и медленный канал не должен считаться обрывом.
const READ_TIMEOUT_MS = 20000;
const WRITE_TIMEOUT_MS = 120000;

// Ограничение снимать по приходу заголовков нельзя: картинка из хранилища
// докачивается уже после них, и оборваться связь может ровно там — так и было
// в логе 11.09.2026 (UND_ERR_SOCKET на 475-й тысяче байт). Поэтому счётчик
// тикает до конца чтения: предел накрывает весь запрос целиком.
function timeoutSignal(init) {
  const method = String(init?.method || "GET").toUpperCase();
  const limit = method === "GET" || method === "HEAD" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;

  // Готовый AbortSignal.timeout() здесь не подходит, хотя просится: он
  // отменяет запрос ошибкой с именем TimeoutError, а postgrest-js считает
  // отменой только AbortError — всё остальное он повторяет трижды с паузами.
  // Проверено на живой базе: с AbortSignal.timeout один запрос уходил в
  // четыре попытки, то есть предел в 20 секунд превращался в полторы минуты
  // ожидания. Своя отмена с правильным именем повторов не вызывает.
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(
      new DOMException(
        `Supabase не ответил за ${Math.round(limit / 1000)} с`,
        "AbortError"
      )
    );
  }, limit);

  // Свой сигнал Supabase передаёт не всегда, но когда передаёт — его нельзя
  // терять: на нём держится отмена запроса. Поэтому сигналы складываются.
  // AbortSignal.any появился в Node 20; на более старом узле остаётся наш
  // предел — отмену мы так теряем, зато бесконечное ожидание уходит.
  if (!init?.signal) return controller.signal;
  return typeof AbortSignal.any === "function"
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;
}

export const CARDS_BUCKET = "cards";

// Закрытый бакет для оригиналов карт, нарисованных посетителями. Публичной
// ссылки у его файлов нет вовсе: оригинал отдаёт наш сервер и только тому,
// кому положено (см. app/api/original). В публичном бакете рядом лежит
// превью с водяным знаком — его видят все.
export const ORIGINALS_BUCKET = "cards-private";

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
      fetch: (input, init) =>
        fetch(input, { ...init, cache: "no-store", signal: timeoutSignal(init) }),
    },
  });
}
