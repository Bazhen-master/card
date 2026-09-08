// Настройки, которые владелица сайта меняет сама в /admin/settings.
//
// Почему в базе, а не в переменных окружения: переменную она правит в панели
// хостинга, и это перезапуск приложения; сумму бонуса и длину бесплатного
// периода она будет подбирать на ходу, глядя на первых пользователей.
//
// Пока таблицы `settings` нет (её создаёт supabase/schema.sql), сайт работает
// на значениях по умолчанию и нигде не падает — страница настроек в этом
// случае прямо говорит, что надо выполнить скрипт.

export const SETTINGS_DEFAULTS = {
  // Копейки. 100 ₽ — сумма, которую заказчица назвала для тестового периода.
  signup_bonus: 10000,
  // Дней от регистрации, пока действуют бесплатные генерации. 0 — без срока.
  free_period_days: 7,
};

export const SETTINGS_LIMITS = {
  signup_bonus: { min: 0, max: 1000000 },   // до 10 000 ₽
  free_period_days: { min: 0, max: 365 },
};

export async function readSettings(supabase) {
  const { data, error } = await supabase.from("settings").select("key, value");

  // Нет таблицы — не беда: работаем на умолчаниях, но помним об этом, чтобы
  // сказать в админке.
  if (error) return { ...SETTINGS_DEFAULTS, tableReady: false };

  const values = { ...SETTINGS_DEFAULTS, tableReady: true };
  for (const row of data ?? []) {
    if (!(row.key in SETTINGS_DEFAULTS)) continue;
    const number = Number(row.value);
    const limit = SETTINGS_LIMITS[row.key];
    if (Number.isFinite(number) && number >= limit.min && number <= limit.max) {
      values[row.key] = Math.round(number);
    }
  }
  return values;
}

export async function writeSetting(supabase, key, value) {
  if (!(key in SETTINGS_DEFAULTS)) throw new Error(`Неизвестная настройка: ${key}`);

  const limit = SETTINGS_LIMITS[key];
  if (!Number.isFinite(value) || value < limit.min || value > limit.max) {
    throw new Error("Значение вне допустимых границ");
  }

  const { error } = await supabase
    .from("settings")
    .upsert(
      { key, value: String(Math.round(value)), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    throw new Error(
      /relation|does not exist|schema cache/i.test(error.message)
        ? "В базе нет таблицы settings — выполните supabase/schema.sql в SQL-редакторе Supabase"
        : error.message
    );
  }
}

// Есть ли в базе колонка cards.title. Проверка нужна, потому что схему
// выполняет владелица сайта руками, а деплой кода происходит сам: между этими
// двумя моментами сайт обязан работать. Пока колонки нет — поля названия
// просто не показываем и в базу его не пишем.
export async function cardTitleReady(supabase) {
  const { error } = await supabase.from("cards").select("title").limit(1);
  return !error;
}

// Список колонок с названием или без — по готовности базы. Прочитать
// несуществующую колонку нельзя: PostgREST отвечает ошибкой на весь запрос, и
// витрина осталась бы пустой. Поэтому страницы, которые показывают название,
// сначала спрашивают cardTitleReady, а потом собирают выборку этой функцией.
export function withTitle(columns, ready) {
  return ready ? `${columns}, title` : columns;
}
