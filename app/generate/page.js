import Link from "next/link";
import CardTile from "@/components/CardTile";
import Field from "@/components/Field";
import SetupNotice from "@/components/SetupNotice";
import SubmitButton from "@/components/SubmitButton";
import {
  DEFAULT_FORMAT,
  FORMATS,
  PROVIDER_KEYS_URL,
  PROVIDER_TITLE,
  STYLES,
  isImageProviderConfigured,
  missingImageProviderEnv,
} from "@/lib/image-provider";
import {
  PER_SESSION_PER_DAY,
  generationsTableReady,
  ipHash,
  readSessionId,
  remainingGenerations,
} from "@/lib/generation-limit";
import {
  getSupabase,
  isSupabaseConfigured,
  missingSupabaseEnv,
} from "@/lib/supabase";
import { currentProfile } from "@/lib/account";
import { GENERATION_PRICE, balanceOf } from "@/lib/balance";
import { formatPrice } from "@/lib/format";
import { originalSrc } from "@/lib/storage";
import { generateCard } from "./actions";

// Результат зависит от cookie посетителя и от базы — кэшировать нечего.
export const dynamic = "force-dynamic";

export const metadata = { title: "Сгенерировать карту" };

export default async function GeneratePage({ searchParams }) {
  const heading = <h1 className="text-2xl font-semibold">Сгенерировать свою карту</h1>;

  if (!isSupabaseConfigured) {
    return (
      <section className="space-y-4">
        {heading}
        <SetupNotice missing={missingSupabaseEnv()} />
      </section>
    );
  }

  if (!isImageProviderConfigured) {
    return (
      <section className="space-y-4">
        {heading}
        <SetupNotice
          missing={missingImageProviderEnv()}
          title="Генерация ещё не подключена"
        >
          <p>
            Карты рисует {PROVIDER_TITLE}. Ключ выдаётся в личном кабинете{" "}
            <a className="underline" href={PROVIDER_KEYS_URL}>
              {new URL(PROVIDER_KEYS_URL).host}
            </a>{" "}
            и добавляется в переменные окружения на хостинге. Подробности — в
            README, раздел «Генерация карт».
          </p>
        </SetupNotice>
      </section>
    );
  }

  const supabase = getSupabase();

  if (!(await generationsTableReady(supabase))) {
    return (
      <section className="space-y-4">
        {heading}
        <SetupNotice title="Журнал генераций ещё не создан в базе">
          <p>
            Выполните <code>supabase/schema.sql</code> в Supabase → SQL Editor →
            New query. Скрипт можно запускать повторно: существующие таблицы он
            не трогает, добавит только недостающую <code>generations</code>.
          </p>
        </SetupNotice>
      </section>
    );
  }

  const session = readSessionId();
  const profile = await currentProfile();
  const left = await remainingGenerations(supabase, {
    session,
    ip: ipHash(),
    profile: profile?.id,
  });

  // Бесплатные кончились — дальше за баллы, и только у вошедшего: у гостя
  // баланса нет и быть не может.
  const balance = profile ? await balanceOf(supabase, profile.id) : 0;
  const payable = left <= 0 && profile && balance >= GENERATION_PRICE;

  const error = searchParams?.error;
  const justCreatedId = searchParams?.card;

  const { data: justCreated } = justCreatedId
    ? await supabase
        .from("cards")
        .select("id, image_url, text")
        .eq("id", justCreatedId)
        .maybeSingle()
    : { data: null };

  // У вошедшего история берётся из аккаунта и переживает смену браузера,
  // у гостя — из журнала по cookie, как и раньше.
  const { data: history } = profile
    ? await supabase
        .from("cards")
        .select("id, image_url, text")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(8)
    : session
      ? await supabase
          .from("generations")
          .select("id, cards(id, image_url, text)")
          .eq("session_id", session)
          .order("created_at", { ascending: false })
          .limit(8)
      : { data: null };

  const earlier = (history ?? [])
    .map((row) => (profile ? row : row.cards))
    .filter((card) => card && card.id !== justCreatedId);

  return (
    <section className="space-y-8">
      {heading}

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Анонс по просьбе заказчицы: посетитель должен понимать, что сейчас
          сеть одна, а дальше будет выбор. Ни сроков, ни названий моделей здесь
          нет намеренно — обещать конкретную сеть до её проверки нельзя. */}
      <p className="rounded-lg border border-dashed border-accent/40 bg-accent/5 px-4 py-3 text-sm text-gray-600">
        <span className="font-medium text-accent">Скоро.</span> Появится выбор
        нейросети: разные модели рисуют по-разному и стоят по-разному. И можно
        будет не рисовать заново, а поправить уже готовую карту — дорисовать
        деталь или изменить кусочек.
      </p>

      {justCreated && (
        <div className="space-y-3">
          <h2 className="font-medium">Ваша карта готова</h2>
          <div className="max-w-sm">
            <CardTile card={justCreated} ratio="auto" src={originalSrc(justCreated)} />
          </div>
        </div>
      )}

      <form action={generateCard} className="max-w-xl space-y-4">
        <Field
          label="Опишите карту"
          hint="Чем подробнее описание, тем ближе результат. До 2000 символов, но лучше работают несколько плотных предложений, чем страница текста."
          required
        >
          <textarea
            name="prompt"
            rows={4}
            maxLength={2000}
            required
            placeholder="Например: одинокое дерево на берегу озера в утреннем тумане, мягкий свет, акварель"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </Field>

        {/* Формат — не Field: тот заворачивает содержимое в <label>, а внутри
            метки нельзя держать метки отдельных переключателей. */}
        <fieldset>
          <legend className="mb-1 block text-sm text-gray-700">Формат карты</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {FORMATS.map((format) => (
              <label key={format.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="format"
                  value={format.id}
                  defaultChecked={format.id === DEFAULT_FORMAT}
                  className="h-4 w-4 accent-accent"
                />
                <span>
                  {format.title}{" "}
                  <span className="text-gray-400">({format.hint})</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Стиль">
          <select
            name="style"
            defaultValue="DEFAULT"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pendingLabel="Рисую, до минуты…">
            {payable
              ? `Сгенерировать за ${formatPrice(GENERATION_PRICE)}`
              : "Сгенерировать"}
          </SubmitButton>
          <span className="text-sm text-gray-500">
            {left > 0 ? (
              `Осталось бесплатных сегодня: ${left} из ${PER_SESSION_PER_DAY}`
            ) : payable ? (
              <>
                Бесплатные на сегодня закончились, новые — после полуночи по
                Москве. Следующая сейчас —{" "}
                {formatPrice(GENERATION_PRICE)} с баланса, на нём{" "}
                {formatPrice(balance)}.
              </>
            ) : profile ? (
              <>
                Бесплатные на сегодня закончились, новые — после полуночи по
                Москве. Следующая сейчас стоит{" "}
                {formatPrice(GENERATION_PRICE)}, на балансе{" "}
                {formatPrice(balance)} — пополнение пока делает владелица сайта.
              </>
            ) : (
              <>
                Бесплатные на сегодня закончились, новые — после полуночи по
                Москве.{" "}
                <Link href="/login?from=%2Fgenerate" className="text-accent hover:underline">
                  Войдите
                </Link>
                , чтобы рисовать дальше за {formatPrice(GENERATION_PRICE)}.
              </>
            )}
          </span>
        </div>
        {!profile && (
          <p className="text-sm text-gray-500">
            <Link href="/register" className="text-accent hover:underline">
              Заведите учётную запись
            </Link>{" "}
            — карты сохранятся в кабинете и не потеряются вместе с историей
            браузера. Уже нарисованные перенесутся при первом входе.
          </p>
        )}
      </form>

      {earlier.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Сгенерировано раньше</h2>
          <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-4">
            {earlier.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                ratio="auto"
                src={originalSrc(card)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
