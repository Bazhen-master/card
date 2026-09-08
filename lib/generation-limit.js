import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { readSettings } from "@/lib/settings";

export const SESSION_COOKIE = "mc_session";
export const PER_SESSION_PER_DAY = 5;
export const PER_IP_PER_DAY = 20;

// Бесплатные генерации обнуляются в полночь по Москве, а не через 24 часа
// после каждой генерации. Так было раньше, и заказчица справедливо
// удивилась: нарисовал в 21:00 — жди 21:00 следующего дня. Человек ждёт
// «нового дня», а не скользящего окна.
//
// Москва — UTC+3 круглый год, перехода на летнее время в России нет, поэтому
// сдвиг задан числом: это надёжнее и дешевле, чем тянуть часовые пояса.
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

// Момент последней полуночи по Москве, в UTC. Считаем так: сдвигаем время в
// московское, отрезаем часы-минуты-секунды, сдвигаем обратно.
export function startOfMoscowDay(now = Date.now()) {
  const moscow = now + MOSCOW_OFFSET_MS;
  return new Date(moscow - (moscow % 86400000) - MOSCOW_OFFSET_MS);
}

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

// Сколько генераций оплачено баллами за тот же день. Отдельного признака в
// журнале генераций нет намеренно: платная генерация всегда оставляет строку
// в журнале баланса, и её достаточно — лишняя колонка означала бы ещё один
// поход владелицы сайта в SQL-редактор.
async function paidSince(supabase, profile, since) {
  if (!profile) return 0;

  const { count, error } = await supabase
    .from("balance_entries")
    .select("id", { count: "exact" })
    .eq("profile_id", profile)
    .eq("kind", "generation")
    .gte("created_at", since)
    .limit(1);

  if (error) {
    throw new Error("Не удалось проверить оплаченные генерации: " + error.message);
  }
  return count ?? 0;
}

// С какого момента посетителю считать бесплатный период. У вошедшего это дата
// регистрации, у гостя — первая его генерация: даты «прихода» на сайт у гостя
// нет вовсе, а первая генерация — ровно тот момент, когда он начал тратить
// деньги площадки. Без этого гостевой режим стал бы дырой: аккаунт через
// неделю платит, а тот же человек без входа рисует бесплатно всегда.
async function countdownStart(supabase, { profile, session }) {
  if (profile) {
    const { data } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", profile)
      .maybeSingle();
    return data?.created_at ? new Date(data.created_at) : null;
  }

  if (!session) return null;

  const { data } = await supabase
    .from("generations")
    .select("created_at")
    .eq("session_id", session)
    .order("created_at", { ascending: true })
    .limit(1);

  return data?.[0]?.created_at ? new Date(data[0].created_at) : null;
}

// Когда заканчивается бесплатный период. null — если он бессрочный (0 дней в
// настройках) или отсчёт ещё не начался (гость без единой генерации).
export function freePeriodEnd(start, days) {
  if (!days || !start) return null;
  return new Date(start.getTime() + days * 86400000);
}

// Сколько БЕСПЛАТНЫХ генераций посетителю ещё доступно сегодня — то есть с
// последней полуночи по Москве.
// Оплаченные из счёта вычитаются: за них уже заплачено, и съедать ими
// завтрашние бесплатные было бы двойной платой.
// У вошедшего счёт идёт по аккаунту, у гостя — по cookie. Разница
// принципиальная: cookie посетитель чистит сам, аккаунт — нет.
//
// Возвращает не число, а положение дел целиком: страница должна отличать
// «на сегодня всё, приходите после полуночи» от «бесплатный период кончился,
// дальше только за баллы» — это разные новости для посетителя.
export async function generationAllowance(supabase, { session, ip, profile }) {
  const since = startOfMoscowDay().toISOString();
  const { free_period_days: freeDays } = await readSettings(supabase);

  const [byVisitor, byIp, paid, start] = await Promise.all([
    profile
      ? usedSince(supabase, "profile_id", profile, since)
      : usedSince(supabase, "session_id", session, since),
    usedSince(supabase, "ip_hash", ip, since),
    paidSince(supabase, profile, since),
    freeDays ? countdownStart(supabase, { profile, session }) : Promise.resolve(null),
  ]);

  const periodEnd = freePeriodEnd(start, freeDays);
  const periodOver = Boolean(periodEnd && periodEnd.getTime() <= Date.now());

  const left = Math.max(
    0,
    Math.min(
      PER_SESSION_PER_DAY - Math.max(0, byVisitor - paid),
      PER_IP_PER_DAY - Math.max(0, byIp - paid)
    )
  );

  return { free: periodOver ? 0 : left, periodOver, periodEnd, freeDays };
}

// Таблица создаётся скриптом supabase/schema.sql. Если после обновления его не
// выполнили, страница должна сказать об этом прямо, а не падать с ошибкой.
export async function generationsTableReady(supabase) {
  const { error } = await supabase.from("generations").select("id").limit(1);
  return !error;
}
