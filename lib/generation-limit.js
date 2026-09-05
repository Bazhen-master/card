import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";

export const SESSION_COOKIE = "mc_session";
export const PER_SESSION_PER_DAY = 5;
export const PER_IP_PER_DAY = 20;

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Посетитель опознаётся случайным id в cookie — полноценных аккаунтов на этом
// этапе нет. Cookie чистится, и лимит обходится, поэтому второй рубеж считается
// по адресу: генерация тратит деньги заказчицы, оставлять её без ограничений
// нельзя.
export function readSessionId() {
  return cookies().get(SESSION_COOKIE)?.value || null;
}

// Выдать id, если его ещё нет. Ставить cookie можно только из server action
// или роута, поэтому при обычном рендере страницы вызывается readSessionId().
export function ensureSessionId() {
  const jar = cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

// Сам адрес не храним, в таблицу идёт только хеш. Это не защита от того, кто
// получил дамп базы и перебирает адреса, а способ не держать персональные
// данные там, где для лимита достаточно их отпечатка.
export function ipHash() {
  const store = headers();
  const forwarded = store.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || store.get("x-real-ip") || "";
  if (!ip) return null;
  return createHash("sha256").update(`metaphor-cards:${ip}`).digest("hex");
}

async function usedSince(supabase, column, value, since) {
  if (!value) return 0;

  // Без head: true. С ним supabase-js не отдаёт ошибку отсутствующей таблицы,
  // count приходит null, лимит считается нулевым — и ограничение исчезает.
  const { count, error } = await supabase
    .from("generations")
    .select("id", { count: "exact" })
    .eq(column, value)
    .gte("created_at", since)
    .limit(1);

  if (error) throw new Error(`Не удалось проверить лимит генераций: ${error.message}`);
  return count ?? 0;
}

// Сколько генераций посетителю ещё доступно за последние сутки.
export async function remainingGenerations(supabase, { session, ip }) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const [bySession, byIp] = await Promise.all([
    usedSince(supabase, "session_id", session, since),
    usedSince(supabase, "ip_hash", ip, since),
  ]);

  return Math.max(
    0,
    Math.min(PER_SESSION_PER_DAY - bySession, PER_IP_PER_DAY - byIp)
  );
}

// Таблица создаётся скриптом supabase/schema.sql. Если после обновления его не
// выполнили, страница должна сказать об этом прямо, а не падать с ошибкой.
export async function generationsTableReady(supabase) {
  const { error } = await supabase.from("generations").select("id").limit(1);
  return !error;
}
