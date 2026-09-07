import { cache } from "react";
import { cookies } from "next/headers";
import { readSessionId } from "@/lib/generation-limit";
import { getSupabase } from "@/lib/supabase";

export const ACCOUNT_COOKIE = "mc_account";
export const MIN_PASSWORD = 8;

// Месяц. Сайт не банк: выкидывать посетителя каждые несколько часов незачем,
// а сессию всегда можно закрыть кнопкой «Выйти» или удалением строки в базе.
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// Пароли хранит и проверяет Supabase Auth, но своей минимальной длины у него
// нет: проверено живым ключом — пароль «123» он принимает. Значит нижнюю
// границу держим здесь.
function validate(email, password) {
  if (!EMAIL.test(email)) throw new Error("Проверьте адрес почты");
  if (password.length < MIN_PASSWORD) {
    throw new Error(`Пароль должен быть не короче ${MIN_PASSWORD} символов`);
  }
}

// Профиль текущего посетителя или null. cache() из React — чтобы за один
// рендер страницы в базу сходили один раз, сколько бы мест ни спросило.
export const currentProfile = cache(async () => {
  const token = cookies().get(ACCOUNT_COOKIE)?.value;
  // Мусор в cookie до базы не доводим: сравнение с uuid отвечает ошибкой.
  if (!token || !UUID.test(token)) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sessions")
    .select("token, profiles(id, email, display_name, is_blocked)")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Не удалось прочитать сессию:", error.message);
    return null;
  }

  const profile = data?.profiles;
  if (!profile || profile.is_blocked) return null;
  return profile;
});

async function ensureProfile(supabase, id, email) {
  const { data } = await supabase
    .from("profiles")
    .select("id, email, display_name, is_blocked")
    .eq("id", id)
    .maybeSingle();
  if (data) return data;

  // Учётная запись в auth.users есть, а профиля нет — так бывает, если строку
  // удалили руками. Восстанавливаем, иначе войти будет нельзя никогда.
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({ id, email })
    .select("id, email, display_name, is_blocked")
    .single();
  if (error) throw new Error(`Не удалось создать профиль: ${error.message}`);
  return created;
}

export async function createAccount({ email, password }) {
  const address = normalizeEmail(email);
  validate(address, password);

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.admin.createUser({
    email: address,
    password,
    // Подтверждение почты выключено намеренно: письма слать нечем, свой
    // почтовый сервис появится вместе с восстановлением пароля.
    email_confirm: true,
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      throw new Error("Этот адрес уже зарегистрирован — войдите или укажите другой");
    }
    throw new Error(`Не удалось создать учётную запись: ${error.message}`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, email: address });

  // Без профиля запись бесполезна и вдобавок займёт адрес: откатываем.
  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw new Error(`Не удалось создать профиль: ${profileError.message}`);
  }

  return { id: data.user.id, email: address };
}

export async function signIn({ email, password }) {
  const address = normalizeEmail(email);
  if (!address || !password) throw new Error("Введите адрес и пароль");

  // Два клиента, и это не лишнее: после signInWithPassword клиент запоминает
  // вошедшего и начинает ходить в базу его токеном вместо служебного ключа —
  // а для обычного пользователя RLS закрыта наглухо, политик у таблиц нет.
  // Поэтому пароль проверяем одним экземпляром, а с таблицами работаем другим.
  const auth = getSupabase();
  const { data, error } = await auth.auth.signInWithPassword({
    email: address,
    password,
  });

  // Не уточняем, что именно не совпало: иначе форма превращается в способ
  // проверять, зарегистрирован ли адрес.
  if (error) throw new Error("Неверный адрес или пароль");

  const supabase = getSupabase();
  const profile = await ensureProfile(supabase, data.user.id, address);
  if (profile.is_blocked) {
    throw new Error("Учётная запись заблокирована. Напишите нам, если это ошибка.");
  }
  return profile;
}

export async function startSession(profileId) {
  const supabase = getSupabase();

  // Заодно подчищаем протухшие строки — отдельная уборка для этого не нужна.
  await supabase.from("sessions").delete().lt("expires_at", new Date().toISOString());

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ profile_id: profileId, expires_at: expiresAt })
    .select("token")
    .single();
  if (error) throw new Error(`Не удалось открыть сессию: ${error.message}`);

  cookies().set(ACCOUNT_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  const jar = cookies();
  const token = jar.get(ACCOUNT_COOKIE)?.value;

  if (token && UUID.test(token)) {
    const supabase = getSupabase();
    await supabase.from("sessions").delete().eq("token", token);
  }

  jar.delete(ACCOUNT_COOKIE);
}

// Карты, сгенерированные до регистрации, переносим в аккаунт. Без этого
// посетитель теряет свою историю ровно в тот момент, когда завёл учётную
// запись, — то есть регистрация выглядит наказанием.
export async function adoptAnonymousHistory(profileId) {
  const session = readSessionId();
  if (!session) return 0;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("generations")
    .select("card_id")
    .eq("session_id", session)
    .is("profile_id", null);

  if (error) {
    console.error("Не удалось найти карты прошлой сессии:", error.message);
    return 0;
  }

  await supabase
    .from("generations")
    .update({ profile_id: profileId })
    .eq("session_id", session)
    .is("profile_id", null);

  const ids = (data ?? []).map((row) => row.card_id).filter(Boolean);
  if (ids.length === 0) return 0;

  await supabase
    .from("cards")
    .update({ owner_id: profileId })
    .in("id", ids)
    .is("owner_id", null);

  return ids.length;
}
